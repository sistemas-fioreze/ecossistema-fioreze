-- Keep the Blog workflow focused on a brief and one private article document.
ALTER TABLE marketing_blog_posts ADD COLUMN article_file_name TEXT;
ALTER TABLE marketing_blog_posts ADD COLUMN article_mime_type TEXT;
ALTER TABLE marketing_blog_posts ADD COLUMN article_size_bytes INTEGER;
ALTER TABLE marketing_blog_posts ADD COLUMN article_object_key TEXT;
ALTER TABLE marketing_blog_posts ADD COLUMN article_uploaded_at TEXT;
