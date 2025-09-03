-- GPS Raw Buffer Table for temporary storage before TimescaleDB
-- Created: 2025-09-02
-- Purpose: Buffer GPS data from legacy system before processing to TimescaleDB

CREATE TABLE IF NOT EXISTS gps_raw_buffer (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- GPS Data Fields
    vehicle_id INT,
    garage_no VARCHAR(20) NOT NULL,
    imei VARCHAR(50),
    timestamp DATETIME NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    speed INT DEFAULT 0,
    course INT DEFAULT 0,
    altitude INT DEFAULT 0,
    satellites INT DEFAULT 0,
    state INT DEFAULT 0,
    in_route INT DEFAULT 0,
    
    -- Metadata Fields
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    process_status ENUM('pending', 'processing', 'sent', 'failed') DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    error_message TEXT NULL,
    source VARCHAR(50) DEFAULT 'legacy',
    
    -- Indexes for Performance
    INDEX idx_status_received (process_status, received_at),
    INDEX idx_vehicle_timestamp (vehicle_id, timestamp),
    INDEX idx_processing (process_status, retry_count),
    INDEX idx_garage_timestamp (garage_no, timestamp),
    INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE gps_raw_buffer COMMENT = 'Buffer table for GPS data from legacy system';