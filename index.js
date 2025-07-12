import express from 'express';
import bodyparser from 'body-parser';
import axios from 'axios';
import env from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';
import session from 'express-session'

env.config();
const app = express();
const port = 3001;
const apiKey = process.env.API_KEY;
const saltround = 10;
app.set('view engine', 'ejs');


const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
})

db.connect();

const randomMovies = [
    "Inception", "Interstellar", "The Matrix", "Pulp Fiction", "Fight Club",
    "Forrest Gump", "The Dark Knight", "Avengers", "Titanic", "Gladiator",
    "Joker", "Shutter Island", "The Prestige", "The Godfather", "Iron Man"
];

app.use(express.static('public'));
app.use(bodyparser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.Secrete_word,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}))

app.get('/', async (req, res) => {
    const random10 = randomMovies.sort(() => 0.5 - Math.random()).slice(0, 10);

    try {
        let movies = [];

        for (let title of random10) {
            const response = await axios.get(`http://www.omdbapi.com/?t=${title}&apikey=${apiKey}`);
            movies.push(response.data);
        }

        res.render('index.ejs', { movies: movies, movie: null, user: req.session.user, error: null });

    } catch (err) {
        console.log(err);
        res.send("Error loading random movies");
    }
});


app.get('/register', (req, res) => {
    res.render('register.ejs')
})

app.get('/login', (req, res) => {
    res.render('login.ejs')
})

app.get('/search', (req, res) => {
    res.render('index.ejs')
})

app.post('/', async (req, res) => {
    const movieName = req.body.movie;

    try {
        const response = await axios.get(`http://www.omdbapi.com/`, {
            params: {
                t: movieName,
                apikey: apiKey,
                plot: 'Short'
            }
        });

        const movie = response.data;

        if (movie.Response === 'False') {
            return res.render('index', { movies: [], movie: null, error: 'Movie not found.' });
        }

        res.render('index', { movies: [], movie: movie, user: req.session.user, error: null });

    } catch (err) {
        console.log(err);
        res.render('index.ejs', { movies: [], movie: null, error: 'Something went wrong.' });
    }
});



app.post('/register', async (req, res) => {
    const username = req.body.Email;
    const password = req.body.Password;

    try {
        const exits = await db.query('SELECT * FROM users WHERE email = $1', [username])
        if (exits.rows.length > 0) {
            return res.send('User already exist. Try logging in!!')
        }
        else {
            bcrypt.hash(password, saltround, async (err, hash) => {
                if (err) { console.log(err) }
                else {
                    const result = await db.query('INSERT INTO users (email,password) VALUES ($1,$2)', [username, hash]);
                    res.redirect('/')
                }
            })
        }
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal server error')
    }
})

app.post('/login', async (req, res) => {
    const username = req.body.Email;
    const password = req.body.Password;

    try {
        const checkuser = await db.query('SELECT * FROM users WHERE email = $1', [username])
        if (checkuser.rows.length > 0) {
            const user = checkuser.rows[0];
            const hashpass = user.password;
            bcrypt.compare(password, hashpass, async (err, result) => {
                if (err) {
                    console.log('Internal Server Error', err)
                }
                else {
                    if (result) {
                        req.session.user = {
                            id: user.id,
                            email: user.email
                        };
                        const random10 = randomMovies.sort(() => 0.5 - Math.random()).slice(0, 10);
                        let movies = [];
                        for (let title of random10) {
                            const response = await axios.get(`http://www.omdbapi.com/?t=${title}&apikey=${apiKey}`);
                            movies.push(response.data);
                        }

                        res.render('index.ejs', { movies: movies, movie: null, user: req.session.user, error: null });
                    }
                    else {
                        res.send('Wrong password.Try again!!')
                    }
                }
            })
        }
        else {
            res.send('User does not exist.Please register')
        }
    } catch (err) {
        console.log(err)
    }
});
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
})