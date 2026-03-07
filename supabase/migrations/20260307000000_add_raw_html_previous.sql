-- Add raw_html_previous column for undo support in HTML mode
ALTER TABLE website_briefs ADD COLUMN IF NOT EXISTS raw_html_previous text;
