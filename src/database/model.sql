create database privacy_msg_send_bot;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    user_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_chat_id bigint NOT NULL,
    user_username varchar(64),
    user_first_name varchar(64),
    user_last_name varchar(64),
    user_phone_number varchar(64),
    user_status boolean NOT NULL DEFAULT false,
    user_created_at timestamp with time zone DEFAULT now() NOT NULL
);