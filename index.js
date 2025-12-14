/* EXPRESS SETUP */
const express = require("express");
const app = express();

app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

app.use(express.static(__dirname));

const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* SESSION */
const session = require("express-session");
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);

/* PASSPORT SETUP */
const passport = require("passport");
app.use(passport.initialize());
app.use(passport.session());

/* MONGOOSE SETUP */
const mongoose = require("mongoose");

// ✅ ВАЖНО: безопасный импорт (в Node/v22 и разных версиях пакета)
const plm = require("passport-local-mongoose");
const passportLocalMongoose = plm.default || plm; // <- вот это фиксит "got object"

mongoose.connect("mongodb://127.0.0.1:27017/MyDatabase", {
  serverSelectionTimeoutMS: 5000,
});

mongoose.connection.on("connected", () => console.log("✅ Mongoose connected"));
mongoose.connection.on("error", (err) => console.log("❌ Mongoose error:", err));
mongoose.connection.on("disconnected", () => console.log("⚠️ Mongoose disconnected"));

const Schema = mongoose.Schema;

/* USER SCHEMA */
const UserSchema = new Schema({
  username: String, // password НЕ храним, passport-local-mongoose сам добавит hash+salt
});

// ✅ теперь это точно функция
UserSchema.plugin(passportLocalMongoose);

const UserDetails = mongoose.model("userInfo", UserSchema, "userInfo");

/* PASSPORT LOCAL AUTHENTICATION */
passport.use(UserDetails.createStrategy());
passport.serializeUser(UserDetails.serializeUser());
passport.deserializeUser(UserDetails.deserializeUser());

/* ROUTES */
const connectEnsureLogin = require("connect-ensure-login");

app.get("/login", (req, res) => {
  res.sendFile("html/login.html", { root: __dirname });
});

app.post("/login", (req, res, next) => {
  console.log("LOGIN BODY:", req.body);

  passport.authenticate("local", (err, user, info) => {
    console.log("AUTH CALLBACK fired", { err, user: !!user, info });

    if (err) return next(err);

    if (!user) {
      const msg = info?.message || "Invalid username or password";
      return res.redirect("/login?info=" + encodeURIComponent(msg));
    }

    req.logIn(user, (err) => {
      console.log("req.logIn callback fired", { err });
      if (err) return next(err);
      return res.redirect("/");
    });
  })(req, res, next);
});

app.get(
  "/",
  connectEnsureLogin.ensureLoggedIn(),
  (req, res) => res.sendFile("html/index.html", { root: __dirname })
);

app.get(
  "/private",
  connectEnsureLogin.ensureLoggedIn(),
  (req, res) => res.sendFile("html/private.html", { root: __dirname })
);

app.get(
  "/user",
  connectEnsureLogin.ensureLoggedIn(),
  (req, res) => res.send({ user: req.user })
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    // optional, но полезно: гасим сессию и cookie
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.sendFile("html/logout.html", { root: __dirname });
    });
  });
});

/* AUTO-SEED USERS (создаст paul/joy/ray если их еще нет) */
async function seedUsersIfEmpty() {
  const count = await UserDetails.countDocuments({});
  if (count > 0) {
    console.log("ℹ️ Users already exist, seeding skipped");
    return;
  }

  const users = [
    { username: "paul", password: "paul" },
    { username: "joy", password: "joy" },
    { username: "ray", password: "ray" },
  ];

  for (const u of users) {
    await new Promise((resolve, reject) => {
      UserDetails.register({ username: u.username }, u.password, (err) => {
        if (err) return reject(err);
        console.log("✅ Registered:", u.username);
        resolve();
      });
    });
  }
}

/* START SERVER */
const port = process.env.PORT || 3000;

mongoose.connection.once("connected", async () => {
  try {
    await seedUsersIfEmpty();
  } catch (e) {
    console.log("❌ Seeding error:", e.message);
  }

  app.listen(port, () => console.log("App listening on port " + port));
});
