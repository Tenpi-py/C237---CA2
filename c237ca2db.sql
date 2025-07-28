CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    contact VARCHAR(20),
    password VARCHAR(64) NOT NULL,
    confirm_password VARCHAR(64) NOT NULL,
    role VARCHAR(10) NOT NULL
);

-- Food Entries Table
CREATE TABLE food_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    food_name VARCHAR(100) NOT NULL,
    image VARCHAR(255),
    calories_in INT,
    calories_out INT
);

ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE food_entries AUTO_INCREMENT = 1;
