const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult, check } = require("express-validator");
const store = require("connect-loki");
const PgPersistence = require("./lib/pg-persistence");
const catchError = require("./lib/catch-error");

const app = express();
const host = "localhost";
const port = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    cookie: {
      httpOnly: true,
      maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
      path: "/",
      secure: false,
    },
    name: "launch-school-todos-session-id",
    resave: false,
    saveUninitialized: true,
    secret: "this is not very secure",
    store: new LokiStore({}),
  })
);

app.use(flash());

// Create a new datastore
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

// Extract session info
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  res.locals.signedIn = req.session.signedIn;
  res.locals.username = req.session.username;
  delete req.session.flash;
  next();
});

const requiresAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    console.log("Unauthorized.");
    res.status(401).send("Unauthorized.");
  } else {
    next();
  }
};

const checkAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    res.redirect(302, "/users/signin");
  } else {
    next();
  }
};

// Redirect start page
app.get("/", (req, res) => {
  res.redirect("/lists");
});

// Render the list of todo lists
app.get(
  "/lists",
  checkAuthentication,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let todoLists = await store.sortedTodoLists();

    let todosInfo = todoLists.map((todoList) => ({
      countAllTodos: todoList.todos.length,
      countDoneTodos: todoList.todos.filter((todo) => todo.done).length,
      isDone: store.isDoneTodoList(todoList),
    }));
    res.render("lists", {
      todoLists,
      todosInfo,
    });
  })
);

// Render new todo list page
app.get("/lists/new", requiresAuthentication, (req, res) => {
  res.render("new-list");
});

// Create a new todo list
app.post(
  "/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters."),
  ],
  requiresAuthentication,
  catchError(async (req, res) => {
    let errors = validationResult(req);
    const todoListTitle = req.body.todoListTitle;
    const titleAlreadyExists = await res.locals.store.todoListTitleExists(
      todoListTitle
    );
    if (titleAlreadyExists) {
      req.flash("error", "The list title must be unique.");
    }
    if (!errors.isEmpty() || titleAlreadyExists) {
      errors.array().forEach((message) => req.flash("error", message.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      const listAdded = await res.locals.store.newTodoList(todoListTitle);
      if (listAdded) {
        req.flash("success", "The todo list has been created.");
        res.redirect("/lists");
      } else {
        req.flash("error", "The list title must be unique.");
        res.render("new-list", {
          flash: req.flash(),
          todoListTitle: req.body.todoListTitle,
        });
      }
    }
  })
);

// Render individual todo list and its todos
app.get(
  "/lists/:todoListId",
  checkAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let todoList = await res.locals.store.loadTodoList(+todoListId);
    if (todoList === undefined) throw new Error("Not found.");
    // todoList.todos = res.locals.store.sortedTodos(todoList.todos);
    res.render("list", {
      todoList,
      isDoneTodoList: res.locals.store.isDoneTodoList(todoList),
      hasUndoneTodos: res.locals.store.hasUndoneTodos(todoList),
    });
  })
);

// Toggle completion status of a todo
app.post(
  "/lists/:todoListId/todos/:todoId/toggle",
  requiresAuthentication,
  catchError(async (req, res) => {
    let { todoListId, todoId } = { ...req.params };
    const toggled = await res.locals.store.toggleDoneTodo(+todoListId, +todoId);
    if (!toggled) throw new Error("Not found.");
    const todo = await res.locals.store.loadTodo(+todoListId, +todoId);
    if (todo.done) {
      req.flash("success", `"${todo.title}" marked done.`);
    } else {
      req.flash("success", `"${todo.title}" marked NOT done!`);
    }

    res.redirect(`/lists/${todoListId}`);
  })
);

// Delete a todo
app.post(
  "/lists/:todoListId/todos/:todoId/destroy",
  requiresAuthentication,
  catchError(async (req, res) => {
    let { todoListId, todoId } = { ...req.params };
    const deleted = await res.locals.store.deleteTodo(+todoListId, +todoId);
    if (!deleted) throw new Error("Not found.");
    req.flash("success", "The todo has been deleted.");
    res.redirect(`/lists/${todoListId}`);
  })
);

// Mark all todos as done
app.post(
  "/lists/:todoListId/complete_all",
  requiresAuthentication,
  catchError(async (req, res, next) => {
    let todoListId = req.params.todoListId;
    const allMarkedDone = await res.locals.store.markAllDone(+todoListId);
    if (!allMarkedDone) throw new Error("Not found.");
    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  })
);

// Create a new todo and add it to the specified list
app.post(
  "/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters."),
  ],
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash("error", message.msg));
      const todoList = await res.locals.store.loadTodoList(+todoListId);
      if (!todoList) throw new Error("Not found.");
      res.render("list", {
        flash: req.flash(),
        todoList,
        isDoneTodoList: res.locals.store.isDoneTodoList(todoList),
        hasUndoneTodos: res.locals.store.hasUndoneTodos(todoList),
      });
    } else {
      const todoAdded = await res.locals.store.addTodo(
        +todoListId,
        req.body.todoTitle
      );
      if (!todoAdded) throw new Error("Not found.");
      req.flash("success", "The todo has been created.");
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

// Render edit todo list form
app.get(
  "/lists/:todoListId/edit",
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    const todoList = await res.locals.store.loadTodoList(+todoListId);
    if (!todoList) throw new Error("Not found.");
    res.render("edit-list", { todoList });
  })
);

// Delete todo list
app.post(
  "/lists/:todoListId/destroy",
  requiresAuthentication,
  catchError(async (req, res) => {
    const todoListId = req.params.todoListId;
    const listDeleted = await res.locals.store.deleteTodoList(+todoListId);
    if (!listDeleted) throw new Error("Not found.");
    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  })
);

// Edit todo list title
app.post(
  "/lists/:todoListId/edit",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters."),
  ],
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let todoListTitle = req.body.todoListTitle;

    const rerenderEditList = async () => {
      let todoList = await res.locals.store.loadTodoList(+todoListId);
      if (!todoList) throw new Error("Not found.");
      res.render("edit-list", {
        flash: req.flash(),
        todoListTitle,
        todoList,
      });
    };
    try {
      let errors = validationResult(req);
      const titleAlreadyExists = await res.locals.store.todoListTitleExists(
        todoListTitle
      );
      if (titleAlreadyExists) {
        req.flash("error", "The list title must be unique.");
      }
      if (!errors.isEmpty() || titleAlreadyExists) {
        errors.array().forEach((message) => req.flash("error", message.msg));
        rerenderEditList();
      } else {
        await res.locals.store.setTitle(+todoListId, todoListTitle);
        req.flash("success", "Todo list updated.");
        res.redirect(`/lists/${todoListId}`);
      }
    } catch (error) {
      if (res.locals.store.isUniqueConstraintViolation(error)) {
        req.flash("error", "The list title must be unique.");
        rerenderEditList();
      } else {
        throw error;
      }
    }
  })
);

app.get("/users/signin", (req, res) => {
  req.flash("info", "Please sign in.");
  res.render("signin", { flash: req.flash() });
});

app.post(
  "/users/signin",
  catchError(async (req, res) => {
    let { username, password } = req.body;
    username = username.trim();
    const signInSuccess = await res.locals.store.signInUser(username, password);
    if (signInSuccess) {
      req.session.username = username;
      req.session.signedIn = true;
      req.flash("success", "Welcome!");
      res.redirect("/lists");
    } else {
      req.flash("error", "Invalid credentials.");
      res.render("signin", { flash: req.flash() });
    }
  })
);

app.post("/users/signout", (req, res) => {
  delete req.session.username;
  delete req.session.signedIn;
  res.redirect("/lists");
});

// Error handler
app.use((err, _, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});
