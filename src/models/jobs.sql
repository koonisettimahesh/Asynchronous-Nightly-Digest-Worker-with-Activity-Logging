CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    payload JSONB,
    current_state VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
