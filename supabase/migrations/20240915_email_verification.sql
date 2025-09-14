-- Email Verification System
-- Creates tables and functions for secure email verification

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.email_verification_tokens CASCADE;

-- Create email verification tokens table
CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    token text NOT NULL,
    expires_at timestamptz NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    verified_at timestamptz DEFAULT NULL,

    -- Constraints
    CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
    CONSTRAINT valid_token CHECK (length(token) = 6 AND token ~ '^[0-9]+$'),
    CONSTRAINT future_expiry CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_email ON public.email_verification_tokens(email);
CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_expires_at ON public.email_verification_tokens(expires_at);
CREATE INDEX idx_email_verification_tokens_verified ON public.email_verification_tokens(verified);

-- Create composite index for verification lookup
CREATE UNIQUE INDEX idx_email_verification_unique_active ON public.email_verification_tokens(user_id, email, token)
WHERE verified = false;

-- Enable RLS
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own verification tokens"
ON public.email_verification_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create verification tokens for themselves"
ON public.email_verification_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own verification tokens"
ON public.email_verification_tokens FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can manage all tokens (for API endpoints)
CREATE POLICY "Service role can manage all verification tokens"
ON public.email_verification_tokens FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.email_verification_tokens
    WHERE expires_at < now()
    AND verified = false;

    RAISE NOTICE 'Cleaned up expired verification tokens';
END;
$$;

-- Create function to validate verification token
CREATE OR REPLACE FUNCTION public.validate_verification_token(
    p_user_id uuid,
    p_email text,
    p_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token_record record;
    result json;
BEGIN
    -- Find the token
    SELECT * INTO token_record
    FROM public.email_verification_tokens
    WHERE user_id = p_user_id
    AND email = p_email
    AND token = p_token
    AND verified = false;

    -- Check if token exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Invalid verification code'
        );
    END IF;

    -- Check if token is expired
    IF token_record.expires_at < now() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Verification code has expired'
        );
    END IF;

    -- Token is valid
    RETURN json_build_object(
        'valid', true,
        'token_id', token_record.id,
        'expires_at', token_record.expires_at
    );
END;
$$;

-- Create function to mark token as verified
CREATE OR REPLACE FUNCTION public.mark_token_verified(p_token_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.email_verification_tokens
    SET verified = true,
        verified_at = now()
    WHERE id = p_token_id;

    RETURN FOUND;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE public.email_verification_tokens IS 'Stores email verification tokens with expiry and security constraints';
COMMENT ON FUNCTION public.cleanup_expired_verification_tokens() IS 'Removes expired and unused verification tokens';
COMMENT ON FUNCTION public.validate_verification_token(uuid, text, text) IS 'Validates a verification token and returns status';
COMMENT ON FUNCTION public.mark_token_verified(uuid) IS 'Marks a verification token as verified';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_verification_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_verification_token(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_token_verified(uuid) TO authenticated;

-- Create trigger to automatically clean up old tokens daily
-- (Optional: requires pg_cron extension)
-- SELECT cron.schedule('cleanup-verification-tokens', '0 2 * * *', 'SELECT public.cleanup_expired_verification_tokens();');

RAISE NOTICE 'Email verification system created successfully';