const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  isDoneTodoList(todoList) {
    return (
      todoList.todos.length > 0 && todoList.todos.every((todo) => todo.done)
    );
  }

  hasUndoneTodos(todoList) {
    return (
      todoList.todos.length > 0 && todoList.todos.some((todo) => !todo.done)
    );
  }

  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach((todoList) => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }

  // Return the list of todo lists sorted by completion status and title (case-
  // insensitive).
  async sortedTodoLists() {
    const ALL_TODOLISTS =
      "SELECT * FROM todolists WHERE username = $1 ORDER BY lower(title) ASC";
    const FIND_TODOS = "SELECT * FROM todos WHERE username = $1";

    let resultTodoLists = dbQuery(ALL_TODOLISTS, this.username);
    let resultTodos = dbQuery(FIND_TODOS, this.username);
    const resultBoth = await Promise.all([resultTodoLists, resultTodos]);
    let todoLists = resultBoth[0].rows;
    let todos = resultBoth[1].rows;
    if (!todoLists || !todos) return undefined;
    todoLists.forEach(
      (todoList) =>
        (todoList.todos = todos.filter(
          (todo) => todoList.list_id === todo.list_id
        ))
    );

    return this._partitionTodoLists(todoLists);
  }

  async loadTodoList(todoListId) {
    const FIND_TODO_LIST =
      "SELECT * FROM todolists WHERE list_id = $1 AND username = $2";
    const FIND_TODOS =
      "SELECT * FROM todos WHERE list_id = $1 AND username = $2 ORDER BY done ASC, lower(title) ASC";
    const { rows } = await dbQuery(FIND_TODO_LIST, todoListId, this.username);
    const todoList = rows[0];
    if (!todoList) return undefined;
    ({ rows: todoList.todos } = await dbQuery(
      FIND_TODOS,
      todoListId,
      this.username
    ));
    return todoList;
  }

  async loadTodo(todoListId, todoId) {
    const FIND_TODO =
      "SELECT * FROM todos WHERE list_id = $1 AND todo_id = $2 AND username = $3";
    const { rows } = await dbQuery(
      FIND_TODO,
      todoListId,
      todoId,
      this.username
    );
    console.log(rows);
    return rows[0];
  }

  async todoListTitleExists(todoListTitle) {
    const CHECK_TITLE_EXISTS =
      "SELECT COUNT(*) AS list_count FROM todolists WHERE title ILIKE $1 AND username = $2";
    const { rows } = await dbQuery(
      CHECK_TITLE_EXISTS,
      todoListTitle,
      this.username
    );
    return rows[0].list_count > 0;
  }

  async newTodoList(todoListTitle) {
    const NEW_TODOLIST =
      "INSERT INTO todolists (title, username) VALUES ($1, $2)";
    try {
      const { rowCount } = await dbQuery(
        NEW_TODOLIST,
        todoListTitle,
        this.username
      );
      return rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO =
      "DELETE FROM todos WHERE list_id = $1 AND todo_id = $2 AND username = $3";
    const { rowCount } = await dbQuery(
      DELETE_TODO,
      todoListId,
      todoId,
      this.username
    );
    return rowCount > 0;
  }

  async deleteTodoList(todoListId) {
    const DELETE_LIST =
      "DELETE FROM todolists WHERE list_id = $1 AND username = $2";
    const { rowCount } = await dbQuery(DELETE_LIST, todoListId, this.username);
    return rowCount > 0;
  }

  async setTitle(todoListId, todoListTitle) {
    const SET_TITLE =
      "UPDATE todolists SET title = $1 WHERE list_id = $2 AND username = $3";
    const { rowCount } = await dbQuery(
      SET_TITLE,
      todoListTitle,
      todoListId,
      this.username
    );
    return rowCount > 0;
  }

  async markAllDone(todoListId) {
    const MARK_ALL_DONE =
      "UPDATE todos SET done = true WHERE list_id = $1 AND username = $2";
    const { rowCount } = await dbQuery(
      MARK_ALL_DONE,
      todoListId,
      this.username
    );
    return rowCount > 0;
  }

  async toggleDoneTodo(todoListId, todoId) {
    const TOGGLE_DONE =
      "UPDATE todos SET done = NOT done WHERE list_id = $1 AND todo_id = $2 AND username = $3";

    const result = await dbQuery(
      TOGGLE_DONE,
      todoListId,
      todoId,
      this.username
    );
    return result.rowCount > 0;
  }

  async addTodo(todoListId, todoTitle) {
    const INSERT_TODO =
      "INSERT INTO todos (list_id, title, username) VALUES ($1, $2, $3)";
    const result = await dbQuery(
      INSERT_TODO,
      todoListId,
      todoTitle,
      this.username
    );
    return result.rowCount > 0;
  }

  async signInUser(username, password) {
    const SIGN_IN = "SELECT password FROM users WHERE username = $1";
    const result = await dbQuery(SIGN_IN, username);
    if (result.rowCount === 0) return false;
    return bcrypt.compare(password, result.rows[0].password);
  }
};
