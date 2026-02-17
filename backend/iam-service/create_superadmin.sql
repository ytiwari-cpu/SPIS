-- Create Super Admin User
-- National ID: 00000000000000
-- Email: ytiwari@argusoft.com  
-- Password: Argus@1213141

-- Step 1: Create user with hashed password
-- Password hash generated with: bcrypt.hash('Argus@1213141', 10)
-- National ID hash: SHA256 hash of '00000000000000'

DO $$
DECLARE
  v_user_id UUID;
  v_password_hash TEXT := '$2b$10$MADxE4LpwGUIfIxWwhdAre901nB.NufibcAky2vPlYAMbk9kNSkEC'; -- bcrypt hash of 'Argus@1213141'
  v_national_id_hash TEXT := '2e6e15a38c6fe8b624fca13be00a737947a8096fd5620795696b5b63cd7feea4'; -- SHA256 of '00000000000000'
  v_email TEXT := 'ytiwari@argusoft.com';
BEGIN
  -- Check if user exists
  SELECT user_id INTO v_user_id
  FROM users
  WHERE email = v_email OR national_id_hash = v_national_id_hash;

  IF v_user_id IS NOT NULL THEN
    -- Update existing user
    UPDATE users
    SET password_hash = v_password_hash,
        status = 'active',
        national_id_hash = v_national_id_hash,
        updated_at = NOW()
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Updated existing user: %', v_user_id;
  ELSE
    -- Create new user
    INSERT INTO users (email, password_hash, national_id_hash, status)
    VALUES (v_email, v_password_hash, v_national_id_hash, 'active')
    RETURNING user_id INTO v_user_id;
    
    RAISE NOTICE 'Created new user: %', v_user_id;
  END IF;

  -- Ensure SuperAdmin role is assigned
  INSERT INTO user_roles (user_id, role_name)
  VALUES (v_user_id, 'SuperAdmin')
  ON CONFLICT (user_id, role_name) DO NOTHING;

  RAISE NOTICE 'SuperAdmin role assigned to user: %', v_user_id;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Super Admin user ready!';
  RAISE NOTICE '';
  RAISE NOTICE 'Login credentials:';
  RAISE NOTICE '  National ID: 00000000000000';
  RAISE NOTICE '  Email: ytiwari@argusoft.com';
  RAISE NOTICE '  Password: Argus@1213141';
END $$;
