-- ENTERPRISE DATABASE SCHEMA - SENIOR DEVELOPER OPTIMIZED
-- Performance-optimized with proper indexing, partitioning, and constraints

-- Enable necessary extensions for enterprise features
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ====================
-- AI RESPONSE CACHE TABLE - PERFORMANCE OPTIMIZED
-- ====================
CREATE TABLE IF NOT EXISTS ai_response_cache (
    id BIGSERIAL PRIMARY KEY,
    cache_key VARCHAR(64) NOT NULL UNIQUE,
    response_data JSONB NOT NULL,
    context VARCHAR(100) NOT NULL,
    model_used VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enterprise features
    size_bytes INTEGER GENERATED ALWAYS AS (octet_length(response_data::text)) STORED,
    checksum VARCHAR(32) GENERATED ALWAYS AS (md5(response_data::text)) STORED
);

-- Performance indexes for cache table
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_key_unique 
    ON ai_response_cache(cache_key);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_expires_at 
    ON ai_response_cache(expires_at) 
    WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_context_model 
    ON ai_response_cache(context, model_used);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_created_at 
    ON ai_response_cache(created_at DESC);

-- GIN index for JSONB response data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_response_data_gin 
    ON ai_response_cache USING GIN(response_data);

-- Partial index for active cache entries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_active 
    ON ai_response_cache(cache_key, created_at) 
    WHERE expires_at > NOW();

-- ====================
-- DISTRIBUTED CACHE LOCKS - ENTERPRISE CONCURRENCY CONTROL
-- ====================
CREATE TABLE IF NOT EXISTS cache_locks (
    id BIGSERIAL PRIMARY KEY,
    lock_key VARCHAR(128) NOT NULL,
    lock_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_info JSONB
);

-- Performance indexes for locks
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_locks_key_unique 
    ON cache_locks(lock_key) 
    WHERE expires_at > NOW();
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locks_expires_at 
    ON cache_locks(expires_at);

-- ====================
-- SENTIMENT ANALYSES - PARTITIONED FOR ENTERPRISE SCALE
-- ====================
CREATE TABLE IF NOT EXISTS sentiment_analyses (
    id BIGSERIAL,
    organization_id UUID NOT NULL,
    original_text TEXT NOT NULL,
    sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    confidence_score DECIMAL(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analysis_data JSONB NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    context VARCHAR(100),
    cache_key VARCHAR(64),
    processing_time_ms INTEGER CHECK (processing_time_ms >= 0),
    tokens_used INTEGER CHECK (tokens_used >= 0),
    cost_estimate DECIMAL(10,8) CHECK (cost_estimate >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enterprise audit fields
    request_id UUID,
    user_agent TEXT,
    ip_address INET,
    -- Data classification
    data_classification VARCHAR(20) DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    -- Compliance fields
    retention_date TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (created_at + INTERVAL '7 years') STORED,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and future months (enterprise partitioning)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..12 LOOP -- Create 13 months of partitions
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'sentiment_analyses_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF sentiment_analyses 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
                       
        start_date := end_date;
    END LOOP;
END $$;

-- Performance indexes for sentiment analyses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentiment_org_created 
    ON sentiment_analyses(organization_id, created_at DESC);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentiment_cache_key 
    ON sentiment_analyses(cache_key) 
    WHERE cache_key IS NOT NULL;
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentiment_context_sentiment 
    ON sentiment_analyses(context, sentiment);

-- GIN index for analysis_data JSONB
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentiment_analysis_data_gin 
    ON sentiment_analyses USING GIN(analysis_data);

-- Text search index for original_text
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentiment_text_search 
    ON sentiment_analyses USING GIN(to_tsvector('english', original_text));

-- ====================
-- GENERATED RESPONSES - ENTERPRISE TRACKING
-- ====================
CREATE TABLE IF NOT EXISTS generated_responses (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL,
    original_review TEXT NOT NULL,
    generated_response TEXT NOT NULL,
    response_metadata JSONB,
    sentiment_data JSONB,
    business_context JSONB,
    cache_key VARCHAR(64),
    tokens_used INTEGER CHECK (tokens_used >= 0),
    cost_estimate DECIMAL(10,8) CHECK (cost_estimate >= 0),
    word_count INTEGER CHECK (word_count >= 0),
    response_quality_score DECIMAL(3,2), -- Future ML quality scoring
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enterprise audit fields
    request_id UUID,
    model_version VARCHAR(50),
    is_approved BOOLEAN DEFAULT NULL, -- For human review workflow
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Performance indexes for generated responses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_org_created 
    ON generated_responses(organization_id, created_at DESC);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_cache_key 
    ON generated_responses(cache_key) 
    WHERE cache_key IS NOT NULL;

-- GIN indexes for JSONB fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_metadata_gin 
    ON generated_responses USING GIN(response_metadata);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_sentiment_gin 
    ON generated_responses USING GIN(sentiment_data);

-- ====================
-- ENTERPRISE AUDIT LOG - COMPLIANCE & SECURITY
-- ====================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    session_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Compliance fields
    compliance_reason TEXT,
    retention_date TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (created_at + INTERVAL '7 years') STORED
);

-- Partition audit log by month for performance
ALTER TABLE audit_log 
PARTITION BY RANGE (created_at);

-- Performance indexes for audit log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_table_operation 
    ON audit_log(table_name, operation);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_record_id 
    ON audit_log(table_name, record_id);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user_created 
    ON audit_log(user_id, created_at DESC) 
    WHERE user_id IS NOT NULL;

-- ====================
-- PERFORMANCE MONITORING TABLES
-- ====================
CREATE TABLE IF NOT EXISTS api_metrics (
    id BIGSERIAL PRIMARY KEY,
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    organization_id UUID,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enterprise monitoring fields
    trace_id UUID,
    span_id UUID,
    error_message TEXT,
    rate_limit_remaining INTEGER
);

-- Time-series optimized indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_endpoint_created 
    ON api_metrics(endpoint, created_at DESC);
    
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_status_created 
    ON api_metrics(status_code, created_at DESC);

-- Separate table for aggregated metrics (for dashboards)
CREATE TABLE IF NOT EXISTS api_metrics_hourly (
    endpoint VARCHAR(100),
    hour_bucket TIMESTAMP WITH TIME ZONE,
    request_count INTEGER,
    avg_response_time_ms DECIMAL(10,2),
    error_count INTEGER,
    cache_hit_rate DECIMAL(5,2),
    p95_response_time_ms INTEGER,
    p99_response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (endpoint, hour_bucket)
);

-- ====================
-- ENTERPRISE TRIGGERS & FUNCTIONS
-- ====================

-- Trigger function for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_ai_response_cache_updated_at 
    BEFORE UPDATE ON ai_response_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_responses_updated_at 
    BEFORE UPDATE ON generated_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger function for cache access tracking
CREATE OR REPLACE FUNCTION track_cache_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cache access tracking trigger
CREATE TRIGGER track_ai_response_cache_access 
    BEFORE UPDATE ON ai_response_cache
    FOR EACH ROW 
    WHEN (OLD.response_data = NEW.response_data) -- Only when accessing, not updating content
    EXECUTE FUNCTION track_cache_access();

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD), NOW());
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values, new_values, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(OLD), row_to_json(NEW), NOW());
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW), NOW());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_sentiment_analyses_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sentiment_analyses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ====================
-- ENTERPRISE VIEWS FOR ANALYTICS
-- ====================

-- Cache performance view
CREATE OR REPLACE VIEW cache_performance AS
SELECT 
    context,
    model_used,
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
    AVG(access_count) as avg_access_count,
    SUM(size_bytes) as total_size_bytes,
    MAX(last_accessed_at) as last_activity,
    EXTRACT(EPOCH FROM (AVG(expires_at - created_at))) / 3600 as avg_ttl_hours
FROM ai_response_cache 
GROUP BY context, model_used;

-- Sentiment analysis summary view
CREATE OR REPLACE VIEW sentiment_summary AS
SELECT 
    organization_id,
    context,
    sentiment,
    DATE_TRUNC('hour', created_at) as hour_bucket,
    COUNT(*) as analysis_count,
    AVG(confidence_score) as avg_confidence,
    AVG(processing_time_ms) as avg_processing_time,
    SUM(cost_estimate) as total_cost
FROM sentiment_analyses 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY organization_id, context, sentiment, DATE_TRUNC('hour', created_at);

-- ====================
-- ENTERPRISE MAINTENANCE FUNCTIONS
-- ====================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_response_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO audit_log (table_name, operation, new_values, created_at)
    VALUES ('ai_response_cache', 'CLEANUP', 
            json_build_object('deleted_count', deleted_count), NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired locks
CREATE OR REPLACE FUNCTION clean_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_locks WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate API metrics
CREATE OR REPLACE FUNCTION aggregate_api_metrics()
RETURNS VOID AS $$
BEGIN
    INSERT INTO api_metrics_hourly (
        endpoint, hour_bucket, request_count, avg_response_time_ms, 
        error_count, cache_hit_rate, p95_response_time_ms, p99_response_time_ms
    )
    SELECT 
        endpoint,
        DATE_TRUNC('hour', created_at) as hour_bucket,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time_ms,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
        (COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*)) as cache_hit_rate,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99_response_time_ms
    FROM api_metrics 
    WHERE created_at >= DATE_TRUNC('hour', NOW() - INTERVAL '1 hour')
    AND created_at < DATE_TRUNC('hour', NOW())
    GROUP BY endpoint, DATE_TRUNC('hour', created_at)
    ON CONFLICT (endpoint, hour_bucket) DO UPDATE SET
        request_count = EXCLUDED.request_count,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        error_count = EXCLUDED.error_count,
        cache_hit_rate = EXCLUDED.cache_hit_rate,
        p95_response_time_ms = EXCLUDED.p95_response_time_ms,
        p99_response_time_ms = EXCLUDED.p99_response_time_ms;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- ENTERPRISE SECURITY - ROW LEVEL SECURITY
-- ====================

-- Enable RLS on sensitive tables
ALTER TABLE sentiment_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_responses ENABLE ROW LEVEL SECURITY;

-- Policy for organization data isolation
CREATE POLICY sentiment_analyses_org_isolation ON sentiment_analyses
    FOR ALL TO authenticated
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY generated_responses_org_isolation ON generated_responses
    FOR ALL TO authenticated
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- ====================
-- ENTERPRISE INDEXES FOR PERFORMANCE
-- ====================

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentiment_org_context_created 
    ON sentiment_analyses(organization_id, context, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sentiment_org_sentiment_confidence 
    ON sentiment_analyses(organization_id, sentiment, confidence_score DESC);

-- Covering indexes for read-heavy queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_covering 
    ON ai_response_cache(cache_key) 
    INCLUDE (response_data, created_at, expires_at);

-- ====================
-- ENTERPRISE CONSTRAINTS & VALIDATION
-- ====================

-- Add check constraints for data quality
ALTER TABLE ai_response_cache 
ADD CONSTRAINT check_cache_key_format 
CHECK (cache_key ~ '^[a-f0-9]{64}$');

ALTER TABLE sentiment_analyses 
ADD CONSTRAINT check_confidence_range 
CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1));

-- Add foreign key constraints (assuming organizations table exists)
-- ALTER TABLE sentiment_analyses 
-- ADD CONSTRAINT fk_sentiment_organization 
-- FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ====================
-- PERFORMANCE MONITORING QUERIES
-- ====================

-- Cache hit rate query
CREATE OR REPLACE VIEW cache_hit_rate_daily AS
SELECT 
    DATE(created_at) as date,
    context,
    COUNT(*) as total_requests,
    AVG(access_count) as avg_access_per_entry,
    COUNT(*) FILTER (WHERE access_count > 1) as cache_hits,
    ROUND((COUNT(*) FILTER (WHERE access_count > 1) * 100.0 / COUNT(*)), 2) as hit_rate_percent
FROM ai_response_cache 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), context
ORDER BY date DESC, context;

-- Performance optimization recommendations
COMMENT ON TABLE ai_response_cache IS 'Enterprise AI response cache with performance optimization';
COMMENT ON INDEX idx_cache_key_unique IS 'Primary lookup index for cache keys - critical for performance';
COMMENT ON INDEX idx_cache_expires_at IS 'Cleanup index for expired entries - essential for maintenance';

-- Final optimization
ANALYZE ai_response_cache;
ANALYZE sentiment_analyses;
ANALYZE generated_responses;
ANALYZE audit_log;
ANALYZE api_metrics;