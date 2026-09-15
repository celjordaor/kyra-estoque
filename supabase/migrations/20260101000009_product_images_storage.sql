-- Create product-images storage bucket (public, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
DO $$ BEGIN
  CREATE POLICY "product-images public read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow service role to upload (server actions use admin/service role)
DO $$ BEGIN
  CREATE POLICY "product-images service role insert"
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "product-images service role update"
    ON storage.objects FOR UPDATE
    TO service_role
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "product-images service role delete"
    ON storage.objects FOR DELETE
    TO service_role
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
