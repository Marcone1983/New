#!/usr/bin/env python3
"""
Sherlock Business Profile Search - OSINT Integration
Searches for business profiles across 400+ social networks using Sherlock
"""

import json
import sys
import subprocess
import tempfile
import os
import re
from pathlib import Path
import requests
from urllib.parse import urlparse

class SherlockBusinessSearch:
    def __init__(self):
        self.business_platforms = [
            'Instagram', 'Facebook', 'LinkedIn', 'Twitter', 'TikTok',
            'YouTube', 'Pinterest', 'Snapchat', 'Reddit', 'Medium',
            'Behance', 'Dribbble', 'GitHub', 'GitLab', 'Crunchbase'
        ]
        
    def search_business_profiles(self, business_name, platforms=None):
        """
        Search for business profiles using Sherlock OSINT
        
        Args:
            business_name (str): Name of the business to search
            platforms (list): Specific platforms to search (optional)
            
        Returns:
            dict: Search results with found profiles
        """
        try:
            # Generate business username variations
            usernames = self.generate_business_usernames(business_name)
            
            all_results = {}
            
            # Search each username variation
            for username in usernames:
                results = self.sherlock_search(username, platforms)
                if results:
                    all_results[username] = results
                    
            # Process and rank results
            processed_results = self.process_results(all_results, business_name)
            
            return {
                'success': True,
                'business_name': business_name,
                'searched_usernames': usernames,
                'total_profiles_found': len(processed_results),
                'profiles': processed_results,
                'search_method': 'sherlock_osint'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'business_name': business_name
            }
    
    def generate_business_usernames(self, business_name):
        """Generate likely username variations for a business"""
        usernames = set()
        
        # Clean business name
        clean_name = re.sub(r'[^a-zA-Z0-9]', '', business_name.lower())
        usernames.add(clean_name)
        
        # Add with common separators
        base_variations = [
            business_name.lower().replace(' ', ''),
            business_name.lower().replace(' ', '_'),
            business_name.lower().replace(' ', '.'),
            business_name.lower().replace(' ', '-'),
        ]
        
        for variation in base_variations:
            clean_variation = re.sub(r'[^a-zA-Z0-9._-]', '', variation)
            if clean_variation:
                usernames.add(clean_variation)
        
        # Add business-specific prefixes/suffixes
        business_affixes = ['official', 'real', 'team', 'hq', 'inc', 'corp', 'company']
        
        for affix in business_affixes:
            usernames.add(f"{clean_name}{affix}")
            usernames.add(f"{affix}{clean_name}")
            usernames.add(f"{clean_name}_{affix}")
            usernames.add(f"{affix}_{clean_name}")
        
        # Remove empty or too short usernames
        valid_usernames = [u for u in usernames if len(u) >= 3 and len(u) <= 30]
        
        # Limit to top 10 most likely variations
        return sorted(valid_usernames, key=lambda x: self.username_score(x, business_name))[:10]
    
    def username_score(self, username, original_name):
        """Score username variants by likelihood (higher = more likely)"""
        score = 0
        original_clean = re.sub(r'[^a-zA-Z0-9]', '', original_name.lower())
        
        # Exact match gets highest score
        if username == original_clean:
            score += 100
            
        # Length similarity
        if len(username) == len(original_clean):
            score += 20
        
        # Contains original name
        if original_clean in username:
            score += 50
            
        # Prefer shorter variations
        score -= len(username) * 0.5
        
        # Prefer variations without excessive prefixes/suffixes
        if not any(affix in username for affix in ['official', 'real', 'team']):
            score += 10
            
        return score
    
    def sherlock_search(self, username, target_platforms=None):
        """Execute Sherlock search for a username"""
        try:
            # Create temporary directory for results
            with tempfile.TemporaryDirectory() as temp_dir:
                output_file = os.path.join(temp_dir, f"{username}_results.txt")
                
                # Build Sherlock command
                cmd = ['sherlock', username, '--output', output_file, '--timeout', '10']
                
                # Add platform filtering if specified
                if target_platforms:
                    for platform in target_platforms:
                        cmd.extend(['--site', platform.lower()])
                else:
                    # Focus on business-relevant platforms
                    for platform in self.business_platforms:
                        cmd.extend(['--site', platform.lower()])
                
                # Execute Sherlock
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60  # 1 minute timeout
                )
                
                # Parse results
                if os.path.exists(output_file):
                    return self.parse_sherlock_output(output_file, username)
                else:
                    # Parse from stdout if file not created
                    return self.parse_sherlock_stdout(result.stdout, username)
                    
        except subprocess.TimeoutExpired:
            print(f"Sherlock search timed out for username: {username}")
            return {}
        except Exception as e:
            print(f"Sherlock search failed for {username}: {str(e)}")
            return {}
    
    def parse_sherlock_output(self, output_file, username):
        """Parse Sherlock output file"""
        profiles = {}
        
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Extract profile URLs using regex
            url_pattern = r'https?://[^\s<>"\']*'
            urls = re.findall(url_pattern, content)
            
            for url in urls:
                platform = self.identify_platform(url)
                if platform:
                    profiles[platform] = {
                        'url': url,
                        'username': username,
                        'platform': platform,
                        'verified': self.check_profile_exists(url),
                        'source': 'sherlock'
                    }
                    
        except Exception as e:
            print(f"Error parsing Sherlock output: {str(e)}")
            
        return profiles
    
    def parse_sherlock_stdout(self, stdout, username):
        """Parse Sherlock stdout output"""
        profiles = {}
        
        try:
            lines = stdout.split('\n')
            
            for line in lines:
                if 'https://' in line or 'http://' in line:
                    # Extract URL from line
                    url_match = re.search(r'(https?://[^\s]+)', line)
                    if url_match:
                        url = url_match.group(1)
                        platform = self.identify_platform(url)
                        
                        if platform:
                            profiles[platform] = {
                                'url': url,
                                'username': username,
                                'platform': platform,
                                'verified': True,  # Sherlock only returns found profiles
                                'source': 'sherlock'
                            }
                            
        except Exception as e:
            print(f"Error parsing Sherlock stdout: {str(e)}")
            
        return profiles
    
    def identify_platform(self, url):
        """Identify social media platform from URL"""
        domain_to_platform = {
            'instagram.com': 'instagram',
            'facebook.com': 'facebook',
            'linkedin.com': 'linkedin',
            'twitter.com': 'twitter',
            'x.com': 'twitter',
            'tiktok.com': 'tiktok',
            'youtube.com': 'youtube',
            'pinterest.com': 'pinterest',
            'snapchat.com': 'snapchat',
            'reddit.com': 'reddit',
            'medium.com': 'medium',
            'behance.net': 'behance',
            'dribbble.com': 'dribbble',
            'github.com': 'github',
            'gitlab.com': 'gitlab'
        }
        
        try:
            domain = urlparse(url).netloc.lower()
            # Remove 'www.' prefix
            domain = domain.replace('www.', '')
            
            return domain_to_platform.get(domain)
        except:
            return None
    
    def check_profile_exists(self, url):
        """Quick check if profile URL is accessible"""
        try:
            response = requests.head(
                url, 
                timeout=5,
                allow_redirects=True,
                headers={'User-Agent': 'Mozilla/5.0 (compatible; BusinessSearch/1.0)'}
            )
            return response.status_code == 200
        except:
            return False
    
    def process_results(self, all_results, business_name):
        """Process and rank all search results"""
        processed = []
        seen_urls = set()
        
        for username, profiles in all_results.items():
            for platform, profile_data in profiles.items():
                url = profile_data['url']
                
                # Avoid duplicates
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                
                # Calculate relevance score
                relevance = self.calculate_relevance(username, business_name, platform)
                
                processed_profile = {
                    'id': f"sherlock_{platform}_{hash(url) % 100000}",
                    'name': business_name,
                    'platform': platform,
                    'profile_url': url,
                    'username': username,
                    'verified': profile_data.get('verified', False),
                    'source': 'sherlock_osint',
                    'relevance_score': relevance,
                    'confidence': min(0.9, relevance / 100),
                    'search_method': 'osint'
                }
                
                processed.append(processed_profile)
        
        # Sort by relevance score
        processed.sort(key=lambda x: x['relevance_score'], reverse=True)
        
        return processed[:20]  # Return top 20 results
    
    def calculate_relevance(self, username, business_name, platform):
        """Calculate relevance score for a profile"""
        score = 0
        business_clean = re.sub(r'[^a-zA-Z0-9]', '', business_name.lower())
        
        # Username similarity
        if username == business_clean:
            score += 100
        elif business_clean in username:
            score += 70
        elif any(word in username for word in business_clean.split()):
            score += 40
        
        # Platform priority for businesses
        platform_priority = {
            'linkedin': 30,
            'instagram': 25,
            'facebook': 20,
            'twitter': 15,
            'youtube': 10,
            'tiktok': 5
        }
        score += platform_priority.get(platform, 0)
        
        # Penalize overly long or complex usernames
        if len(username) > 20:
            score -= 10
        
        return max(0, score)

def main():
    """CLI interface for Sherlock business search"""
    if len(sys.argv) < 2:
        print("Usage: python sherlock_business_search.py <business_name> [platforms...]")
        sys.exit(1)
    
    business_name = sys.argv[1]
    platforms = sys.argv[2:] if len(sys.argv) > 2 else None
    
    searcher = SherlockBusinessSearch()
    results = searcher.search_business_profiles(business_name, platforms)
    
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()