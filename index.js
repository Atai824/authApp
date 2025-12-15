/* EXPRESS SETUP */

const express = require('express');
const app = express();

app.use(express.static(__dirname));

const bodyParser = require('body-parser');
const expressSession = require('express-session')({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 60000
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSession);

/* PASSPORT SETUP */

const passport = require('passport');

app.use(passport.initialize());
app.use(passport.session());

/* MONGOOSE SETUP */

const mongoose = require('mongoose');

// ✅ FIX for Node v22: require can return object, plugin() needs a function
const plm = require('passport-local-mongoose');
const passportLocalMongoose = plm.default || plm;

mongoose.connect('mongodb://127.0.0.1:27017/MyDatabase');

const Schema = mongoose.Schema;
const UserDetail = new Schema({
    username: String,
    password: String
});

UserDetail.plugin(passportLocalMongoose);
const UserDetails = mongoose.model('userInfo', UserDetail, 'userInfo');

/* PASSPORT LOCAL AUTHENTICATION */

passport.use(UserDetails.createStrategy());

passport.serializeUser(UserDetails.serializeUser());
passport.deserializeUser(UserDetails.deserializeUser());

/* ROUTES */

const connectEnsureLogin = require('connect-ensure-login');

app.post('/login', (req, res, next) => {
    passport.authenticate('local',
        (err, user, info) => {
            if (err) {
                return next(err);
            }

            if (!user) {
                return res.redirect('/login?info=' + info);
            }

            req.logIn(user, function (err) {
                if (err) {
                    return next(err);
                }
                return res.redirect('/');
            });

        })(req, res, next);
});

app.get('/login',
    (req, res) => res.sendFile('html/login.html',
        { root: __dirname })
);

app.get('/',
    connectEnsureLogin.ensureLoggedIn(),
    (req, res) => res.sendFile('html/index.html', { root: __dirname })
);

app.get('/private',
    connectEnsureLogin.ensureLoggedIn(),
    (req, res) => res.sendFile('html/private.html', { root: __dirname })
);

app.get('/user',
    connectEnsureLogin.ensureLoggedIn(),
    (req, res) => res.send({ user: req.user })
);

app.get('/logout',
    (req, res) => {
        req.logout(),
            res.sendFile('html/logout.html',
                { root: __dirname })
    }
);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('App listening on port ' + port));

/* REGISTER SOME USERS */

//UserDetails.register({ username: 'paul', active: false }, 'paul');
//UserDetails.register({ username: 'joy', active: false }, 'joy');
//UserDetails.register({ username: 'ray', active: false }, 'ray');
