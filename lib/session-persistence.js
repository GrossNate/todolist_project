const SeedData = require("./seed-data");
const deepCopy = require("./deep-copy");
const { sortTodoLists, sortTodos } = require("./sort");
const nextId = require("./next-id");

module.exports = class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(SeedData);
    session.todoLists = this._todoLists;
  }

  // This is just here for compatability.
  isUniqueConstraintViolation(_error) {
    return false;
  }

  isDoneTodoList(todoList) {
    return (
      todoList.todos.length > 0 && todoList.todos.every((todo) => todo.done)
    );
  }

  // Return the list of todo lists sorted by completion status and title (case-
  // insensitive).
  sortedTodoLists() {
    let todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter((todoList) => !this.isDoneTodoList(todoList));
    let done = todoLists.filter((todoList) => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }

  sortedTodos(todos) {
    let undone = todos.filter((todo) => !todo.done);
    let done = todos.filter((todo) => todo.done);
    return deepCopy(sortTodos(undone, done));
  }

  loadTodoList(todoListId) {
    return deepCopy(this._findTodoList(todoListId));
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.some((todo) => !todo.done);
  }

  loadTodo(todoListId, todoId) {
    return deepCopy(this._findTodo(todoListId, todoId));
  }

  _findTodoList(todoListId) {
    return this._todoLists.find(({ id }) => id === todoListId);
  }

  _findTodo(todoListId, todoId) {
    const todoList = this._findTodoList(todoListId);
    if (!todoList) return undefined;
    return todoList.todos.find(({ id }) => id === todoId);
  }

  todoListTitleExists(todoListTitle) {
    return this._todoLists.some(({ title }) => title === todoListTitle);
  }

  newTodoList(todoListTitle) {
    this._todoLists.push({
      id: nextId(),
      todos: [],
      title: todoListTitle,
    });
  }

  deleteTodo(todoListId, todoId) {
    const todoList = this._findTodoList(todoListId);
    if (!todoList) return false; // todo list not found
    const todoIndex = todoList.todos.findIndex(({ id }) => id === todoId);
    if (todoIndex === -1) return false;
    todoList.todos.splice(todoIndex, 1);
    return true;
  }

  deleteTodoList(todoListId) {
    const todoListIndex = this._todoLists.findIndex(
      ({ id }) => id === todoListId
    );
    if (todoListIndex === -1) return false;
    this._todoLists.splice(todoListIndex, 1);
    return true;
  }
  
  setTitle(todoListId, todoListTitle) {
    const todoList = this._findTodoList(todoListId);
    if (!todoList) return false;
    todoList.title = todoListTitle;
    return true;
  }

  markAllDone(todoListId) {
    const todoList = this._findTodoList(todoListId);
    if (!todoList) return false;
    todoList.todos.forEach((todo) => {
      if (!todo.done) {
        this.toggleDoneTodo(todoListId, todo.id);
      }
    });
    return true;
  }

  toggleDoneTodo(todoListId, todoId) {
    const todo = this._findTodo(todoListId, todoId);
    if (!todo) return false;

    todo.done = !todo.done;
    return true;
  }

  addTodo(todoListId, todoTitle) {
    const todoList = this._findTodoList(todoListId);
    if (!todoList) return false;
    todoList.todos.push({
      id: nextId(),
      title: todoTitle,
      done: false,
    });
    return true;
  }
};
