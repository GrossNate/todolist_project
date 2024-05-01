CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL
);

CREATE TABLE todolists (
  list_id serial PRIMARY KEY,
  title text NOT NULL UNIQUE,
  username text NOT NULL REFERENCES users(username) ON DELETE CASCADE
);

CREATE TABLE todos (
  todo_id serial PRIMARY KEY,
  list_id int REFERENCES todolists(list_id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  username text REFERENCES users(username) ON DELETE CASCADE
);
