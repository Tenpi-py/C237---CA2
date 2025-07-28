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

-- Predefined Users (password is SHA-256 hash for "123456")
INSERT INTO users (username, email, contact, password, confirm_password, role) VALUES
('admin', 'admin@example.com', '123456789', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin'),
('user1', 'user1@example.com', '987654321', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'user'),
('user2', 'user2@example.com', '555555555', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'user');

-- Predefined Food Entries
INSERT INTO food_entries (username, food_name, image, calories_in, calories_out) VALUES
('user1', 'Pizza', '/images/pizza.jpg', 800, 200),
('user1', 'Salad', '/images/salad.jpg', 150, 50),
('user2', 'Burger', '/images/burger.jpg', 900, 300),
('admin', 'Apple', '/images/apple.jpg', 95, 0);

ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE food_entries AUTO_INCREMENT = 1;
