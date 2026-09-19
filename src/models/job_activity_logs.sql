CREATE TABLE job_activity_logs (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    state VARCHAR(50) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
