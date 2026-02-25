-- Migration: Vector Similarity Search RPC Function
-- Description: Create match_documents function for semantic search over the
--              documents table populated by n8n NBA News Ingestion workflow.
--              Uses cosine distance (<=>) with pgvector extension.
-- Version: 002
-- Date: 2026-02-11

-- ============================================================================
-- PHASE 1: Create match_documents RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE
    1 - (d.embedding <=> query_embedding) > match_threshold
    AND (
      filter_tags IS NULL
      OR d.metadata->'tags' ?| filter_tags
    )
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- PHASE 2: Create index for faster vector search (if not exists)
-- ============================================================================

-- IVFFlat index for approximate nearest neighbor search
-- lists = 100 is suitable for tables with 1K-100K rows
-- Adjust lists count as the table grows
CREATE INDEX IF NOT EXISTS idx_documents_embedding
ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test the function with a dummy vector (all zeros):
-- SELECT * FROM match_documents(
--   array_fill(0, ARRAY[384])::vector(384),
--   0.0,
--   3
-- );

-- Test with team tag filter:
-- SELECT * FROM match_documents(
--   array_fill(0, ARRAY[384])::vector(384),
--   0.0,
--   3,
--   ARRAY['Lakers']
-- );

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- DROP FUNCTION IF EXISTS match_documents;
-- DROP INDEX IF EXISTS idx_documents_embedding;
