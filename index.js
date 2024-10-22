import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import axios from "axios";
import path from "path";

const app = express();
const port = 3000;

// Add your Google Books API key directly here
const googleBooksApiKey = 'AIzaSyC1sO05yErWzd5EblHi6ttwEZEhMC67dmQ';  // Replace with your actual API key

// Create the connection with your PostgreSQL database and connect to your books table
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "books",
    password: "19677110801",
    port: 5432,
});

// This is a simple console.log check if the database is connected with your Express app
db.connect()
    .then(() => console.log('Connected to the PostgreSQL database'))
    .catch(err => console.error('Connection error', err.stack));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Route for the root URL
app.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM books'); // Fetch all books
        const books = result.rows; // Store books in a variable
        res.render('index', { books }); // Pass books to index.ejs
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).send('Internal Server Error');
    }
});

// This is the route for getting all content from the books table
app.get('/books', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM books');
        const books = result.rows;
        res.render('books', { books });
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle form submission and add a new book with cover image from Google Books API
app.post('/books', async (req, res) => {
    const { title, author, rating, date_read } = req.body;

    try {
        // Check if the book already exists in the database
        const existingBookQuery = await db.query('SELECT * FROM books WHERE title = $1 AND author = $2', [title, author]);
        
        if (existingBookQuery.rows.length > 0) {
            // If the book exists, don't insert it again
            console.log('Book already exists in the database');
            return res.status(409).send('Book already exists in your collection');
        }

        // Fetch book details from Google Books API
        const googleBooksResponse = await axios.get('https://www.googleapis.com/books/v1/volumes', {
            params: {
                q: `${title} ${author}`, // Query using the title and author
                maxResults: 1, // Limit to the top result
                key: googleBooksApiKey // Use your Google Books API key here
            }
        });

        // Check if a book was found
        if (!googleBooksResponse.data.items || googleBooksResponse.data.items.length === 0) {
            return res.status(404).send('Book not found');
        }

        // Extract book cover image (if available) from the API response
        const bookData = googleBooksResponse.data.items[0];
        const coverImageUrl = bookData.volumeInfo.imageLinks ? bookData.volumeInfo.imageLinks.thumbnail : '';

        // Validate and parse rating
        const safeRating = (rating === "N/A" || rating === '') ? null : parseFloat(rating); // Set to null if "N/A" or empty

        // Insert book into the database with cover image
        await db.query(
            'INSERT INTO books (title, author, rating, date_read, cover_image_url) VALUES ($1, $2, $3, $4, $5)',
            [title, author, safeRating, date_read, coverImageUrl]
        );

        res.redirect('/'); // Redirect to home page after adding the book
    } catch (error) {
        console.error('Error adding book or fetching data from Google Books API:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to render edit book form
app.get('/books/edit/:id', async (req, res) => {
    const bookId = req.params.id;
    try {
        const result = await db.query('SELECT * FROM books WHERE id = $1', [bookId]);
        const book = result.rows[0];
        res.render('edit.ejs', { book });
    } catch (error) {
        console.error('Error fetching book for editing:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle updating a book
app.post('/books/edit/:id', async (req, res) => {
    const bookId = req.params.id;
    const { title, author, rating, date_read, cover_image_url } = req.body;

    try {
        await db.query('UPDATE books SET title = $1, author = $2, rating = $3, date_read = $4, cover_image_url = $5 WHERE id = $6', 
            [title, author, rating, date_read, cover_image_url, bookId]);
        res.redirect('/books');
    } catch (error) {
        console.error('Error updating book:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle deleting a book
app.post('/books/delete/:id', async (req, res) => {
    const bookId = req.params.id;
    try {
        await db.query('DELETE FROM books WHERE id = $1', [bookId]);
        res.redirect('/books');
    } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle searching for books
app.get('/books/search', async (req, res) => {
    const query = req.query.query;
    try {
        const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
            params: {
                q: encodeURIComponent(query),
                key: googleBooksApiKey // Use your Google Books API key here
            }
        });
        const books = response.data.items || []; // Get the book items from the response
        res.render('searchResults.ejs', { books }); // Create a new view to display search results
    } catch (error) {
        console.error('Error fetching data from Google Books API:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
