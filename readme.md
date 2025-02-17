# PostgreSQL Functions

- ### Function for creating dynamic tables based on user's input

```sql
CREATE OR REPLACE FUNCTION create_content_type(table_name TEXT, schema JSONB) RETURNS TEXT AS $$
DECLARE
    column_definitions TEXT := '';
    column_entry RECORD;
    col_name TEXT;
    col_type TEXT;
    constraints TEXT;
BEGIN
    -- Construct column definitions from schema
    FOR column_entry IN SELECT * FROM jsonb_each(schema) LOOP
        col_name := quote_ident(column_entry.key); -- Sanitize column name
        col_type := column_entry.value->>'type'; -- Extract data type
        constraints := COALESCE(column_entry.value->>'constraints', ''); -- Extract constraints

        -- Validate supported types
        IF col_type NOT IN ('TEXT', 'INTEGER', 'BOOLEAN', 'TIMESTAMP', 'DATE', 'NUMERIC', 'JSONB') THEN
            RAISE EXCEPTION 'Unsupported data type: %', col_type;
        END IF;

        column_definitions := column_definitions || format('%s %s %s, ', col_name, col_type, constraints);
    END LOOP;

    -- Remove trailing comma and space safely
    column_definitions := TRIM(BOTH ', ' FROM column_definitions);

    -- Prevent empty column definitions
    IF column_definitions = '' THEN
        RAISE EXCEPTION 'Schema must contain at least one column';
    END IF;

    -- Execute dynamic SQL to create table
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I (id SERIAL PRIMARY KEY, %s);', table_name, column_definitions);

    RETURN format('Table %I created successfully (or already exists)', table_name);
END;
$$ LANGUAGE plpgsql;
```

- this function returns _TEXT_

- ### Query for creating tables

```sql
SELECT create_content_type(
    'blog_posts',
    '{
        "title": {"type": "TEXT", "constraints": "NOT NULL"},
        "content": {"type": "JSONB", "constraints": "NOT NULL"},
        "views": {"type": "INTEGER", "constraints": "DEFAULT 0"}
    }'::jsonb
);
```

- ### Function to insert the data into dynamic tables

```sql
CREATE OR REPLACE FUNCTION insert_into_content_type(table_name TEXT, data JSONB) RETURNS BOOLEAN AS $$
DECLARE
    column_names TEXT := '';
    column_values TEXT := '';
    column_entry RECORD;
BEGIN
    -- Construct column names and values dynamically
    FOR column_entry IN SELECT * FROM jsonb_each(data) LOOP
        column_names := column_names || quote_ident(column_entry.key) || ', ';
        column_values := column_values || quote_literal(column_entry.value) || ', ';
    END LOOP;

    -- Remove trailing commas
    column_names := TRIM(BOTH ', ' FROM column_names);
    column_values := TRIM(BOTH ', ' FROM column_values);

    -- Prevent empty inserts
    IF column_names = '' OR column_values = '' THEN
        RAISE EXCEPTION 'Data must contain at least one column';
    END IF;

    -- Execute dynamic SQL to insert data
    EXECUTE format('INSERT INTO %I (%s) VALUES (%s);', table_name, column_names, column_values);

    RETURN TRUE;  -- Successfully inserted
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;  -- Handle error and return false
END;
$$ LANGUAGE plpgsql;
```

- this function returns _Boolean_

* ### Query for inserting the data

```sql
SELECT insert_into_content_type(
    'blog_posts',
    '{"title": "First Blog", "content": "This is a blog post", "published": true}'
);
```

- ### Function to delete data from dynamic tables

```sql
CREATE OR REPLACE FUNCTION delete_content_type_data(table_name TEXT, record_id INT) RETURNS BOOLEAN AS $$
DECLARE
    row_count INT;
BEGIN
    -- Execute dynamic SQL to delete the record
    EXECUTE format('DELETE FROM %I WHERE id = %s;', table_name, record_id);

    -- Capture the number of rows affected
    GET DIAGNOSTICS row_count = ROW_COUNT;

    -- If at least one row was deleted, return TRUE
    IF row_count > 0 THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE; -- Handle errors gracefully
END;
$$ LANGUAGE plpgsql;
```

- Node: This function returns Boolean.

- Query to execute this function

```sql
    SELECT delete_content_type_data('blog_posts', 7);
```

- ### Function to update dynamic table

```sql
CREATE OR REPLACE FUNCTION update_content_type_data(table_name TEXT, id INT, update_data JSONB) RETURNS BOOLEAN AS $$
DECLARE
    update_pairs TEXT := '';
    column_entry RECORD;
    row_count INT;
BEGIN
    -- Construct SET clause dynamically
    FOR column_entry IN SELECT * FROM jsonb_each(update_data) LOOP
        update_pairs := update_pairs || quote_ident(column_entry.key) || ' = ' || quote_literal(column_entry.value) || ', ';
    END LOOP;

    -- Trim the trailing comma safely
    update_pairs := TRIM(BOTH ', ' FROM update_pairs);

    -- Prevent empty updates
    IF update_pairs = '' THEN
        RETURN FALSE; -- No updates provided
    END IF;

    -- Execute the dynamic SQL update
    EXECUTE format('UPDATE %I SET %s WHERE id = %s;', table_name, update_pairs, id);

    -- Get the number of affected rows
    GET DIAGNOSTICS row_count = ROW_COUNT;

    -- Return TRUE if any rows were updated, else FALSE
    RETURN row_count > 0;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE; -- Handle errors gracefully
END;
$$ LANGUAGE plpgsql;
```

- Node: This function returns Boolean.

- Query to execute this

```sql
SELECT update_content_type_data('blog_posts', 1, '{"title": "Updated Title", "views": 100}');
```

## Initialize The System or the Database

- run once.

```sql
CREATE OR REPLACE FUNCTION initialize_database() RETURNS BOOLEAN AS $$
BEGIN
    -- Create Users Table
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Create Roles Table
    CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    );

    -- Create Permissions Table
    CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    );

    -- Create User Roles Mapping Table
    CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role_id INT REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
    );

    -- Create Role Permissions Mapping Table
    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
    );

    -- Insert Default Roles
    INSERT INTO roles (name) VALUES
    ('Super Admin'),
    ('Content Admin')
    ON CONFLICT (name) DO NOTHING;

    -- Insert Default Permissions
    INSERT INTO permissions (name) VALUES
    ('Create Content'),
    ('Edit Content'),
    ('Delete Content')
    ON CONFLICT (name) DO NOTHING;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

## Register Super Admin

```sql
CREATE OR REPLACE FUNCTION register_super_admin(
    p_email TEXT,
    p_password TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    hashed_password TEXT;
    super_admin_role_id INT;
    super_admin_id UUID;
BEGIN
    -- Hash the password (Ensure pgcrypto is enabled)
    hashed_password := crypt(p_password, gen_salt('bf'));

    -- Get the Super Admin role ID
    SELECT id INTO super_admin_role_id FROM roles WHERE name = 'Super Admin';

    -- Ensure role exists
    IF super_admin_role_id IS NULL THEN
        RAISE NOTICE 'Super Admin role not found';
        RETURN FALSE;
    END IF;

    -- Insert the Super Admin user
    INSERT INTO users (email, password_hash, created_at)
    VALUES (p_email, hashed_password, NOW())
    RETURNING id INTO super_admin_id;

    -- Assign the Super Admin role to this user
    INSERT INTO user_roles (user_id, role_id)
    VALUES (super_admin_id, super_admin_role_id);

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

- Query

```sql
SELECT register_super_admin('abhisek@example.com', 'SuperSecurePassword');
```

## Register a Normal User (Created by Super Admin)

```sql
CREATE OR REPLACE FUNCTION register_user(
    p_email TEXT,
    p_password TEXT,
    p_role TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    hashed_password TEXT;
    user_id UUID;
    role_id INT;
BEGIN
    -- Hash the password
    hashed_password := crypt(p_password, gen_salt('bf'));

    -- Insert the user
    INSERT INTO users (email, password_hash, created_at)
    VALUES (p_email, hashed_password, NOW())
    RETURNING id INTO user_id;

    -- Get the role ID
    SELECT id INTO role_id FROM roles WHERE LOWER(name) = LOWER(p_role);
    IF role_id IS NULL THEN
        RAISE NOTICE 'Role not found';
        RETURN FALSE;
    END IF;

    -- Assign role to user
    INSERT INTO user_roles (user_id, role_id) VALUES (user_id, role_id);

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

- Query

```sql
SELECT register_user('user@example.com', 'UserPassword', 'Content Admin');
```

## Assign Role to an Existing User

- Note: update the name of function from assign_role_to_user to update_roles.

```sql
CREATE OR REPLACE FUNCTION assign_role_to_user(
    p_email TEXT,
    p_role TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_role_id INT;
BEGIN
    -- Get the user's ID
    SELECT id INTO v_user_id FROM users WHERE email = p_email;
    IF v_user_id IS NULL THEN
        RETURN FALSE;  -- User does not exist
    END IF;

    -- Get the role's ID
    SELECT id INTO v_role_id FROM roles WHERE name = p_role;
    IF v_role_id IS NULL THEN
        RETURN FALSE;  -- Role does not exist
    END IF;

    -- Remove any existing role assigned to this user
    DELETE FROM user_roles WHERE user_roles.user_id = v_user_id;

    -- Assign the new role to the user
    INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_role_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

- Query

```sql
SELECT assign_role_to_user('contentAdmin@example.com', 'Super Admin');
```

## Check User Role

```sql
CREATE OR REPLACE FUNCTION get_user_role(p_email TEXT)
RETURNS TABLE(role_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT r.name
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql;
```

- Query

```sql
SELECT get_user_role('user@example.com');
```

## Authenticate User

```sql
CREATE OR REPLACE FUNCTION authenticate_user(
    p_email TEXT,
    p_password TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    stored_hash TEXT;
    auth_success BOOLEAN;
BEGIN
    -- Retrieve the hashed password from the database
    SELECT password_hash INTO stored_hash
    FROM users
    WHERE email = p_email;

    -- If no user found, return FALSE
    IF stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Compare provided password with stored hash
    auth_success := (stored_hash = crypt(p_password, stored_hash));

    RETURN auth_success;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

- Query

```sql
SELECT authenticate_user('admin@example.com', 'SuperSecurePassword');
```
