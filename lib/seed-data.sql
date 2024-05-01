INSERT INTO
  todolists (title)
VALUES
  ('Work Todos'),
  ('Home Todos'),
  ('Additional Todos'),
  ('social todos');

INSERT INTO
  todos (title, done, list_id)
VALUES
  (
    'Get coffee',
    true,
    (SELECT list_id FROM todolists WHERE title = 'Work Todos')
  ),
  (
    'Chat with co-workers',
    true,
    (SELECT list_id FROM todolists WHERE title = 'Work Todos')
  ),
  (
    'Duck out of meeting',
    false,
    (SELECT list_id FROM todolists WHERE title = 'Work Todos')
  ),
  (
    'Feed the cats',
    true,
    (SELECT list_id FROM todolists WHERE title = 'Home Todos')
  ),
  (
    'Go to bed',
    true,
    (SELECT list_id FROM todolists WHERE title = 'Home Todos')
  ),
  (
    'Buy milk',
    true,
    (SELECT list_id FROM todolists WHERE title = 'Home Todos')
  ),
  (
    'Study for Launch School',
    true,
    (SELECT list_id FROM todolists WHERE title = 'Home Todos')
  ),
  (
    'Go to Libby''s birthday party',
    false,
    (SELECT list_id FROM todolists WHERE title = 'social todos')
  );