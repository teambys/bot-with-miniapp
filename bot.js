const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const token = '7679342562:AAEZs2D6ZCnf26FV3_YHx2f_D77rlltIsXY';
const bot = new TelegramBot(token, { polling: true });

// Create an Express app to serve the mini app
const app = express();
const port = process.env.PORT || 3000;

// Enable JSON parsing for POST requests
app.use(express.json());

// Store user information
const userInfo = new Map();

// Function to get user info and store it
async function getUserInfo(chatId) {
  if (!userInfo.has(chatId)) {
    try {
      const user = await bot.getChat(chatId);
      userInfo.set(chatId, {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        languageCode: user.language_code,
        isPremium: user.is_premium || false,
        photoUrl: user.photo ? await bot.getFileLink(user.photo.big_file_id) : null
      });
      console.log(`User information stored for ${user.first_name}`);
    } catch (error) {
      console.error('Error fetching user information:', error);
    }
  }
  return userInfo.get(chatId);
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await getUserInfo(chatId);
  const webAppUrl = `https://bot-with-miniapp.onrender.com?chatId=${chatId}`;

  bot.sendMessage(chatId, 'Welcome! Click the button below to open your profile:', {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Open Profile', web_app: { url: webAppUrl } }
      ]]
    }
  });
});

// Serve the mini app HTML
app.get('/', async (req, res) => {
  const chatId = req.query.chatId;
  const user = await getUserInfo(parseInt(chatId));
  
  if (!user) {
    res.status(400).send('User not found');
    return;
  }

  const htmlWithUserInfo = miniAppHtml
    .replace('__USER_FIRST_NAME__', user.firstName)
    .replace('__USER_LAST_NAME__', user.lastName || '')
    .replace('__USER_ID__', user.id)
    .replace('__USER_USERNAME__', user.username || 'Not set')
    .replace('__USER_LANGUAGE__', user.languageCode || 'Not available')
    .replace('__USER_PREMIUM__', user.isPremium ? 'Yes' : 'No')
    .replace('__USER_PHOTO_URL__', user.photoUrl || 'https://via.placeholder.com/100');

  res.send(htmlWithUserInfo);
});

// Handle note operations
app.post('/api/notes', async (req, res) => {
  const { userId, action, noteId, content } = req.body;
  const notesDir = path.join(__dirname, 'notes');
  const userNotesFile = path.join(notesDir, `${userId}.json`);

  try {
    await fs.mkdir(notesDir, { recursive: true });

    let notes = [];
    try {
      const data = await fs.readFile(userNotesFile, 'utf8');
      notes = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    switch (action) {
      case 'create':
        if (notes.length >= 20) {
          return res.status(400).json({ error: 'Maximum number of notes reached' });
        }
        const newNote = { id: Date.now(), content };
        notes.push(newNote);
        break;
      case 'update':
        const noteIndex = notes.findIndex(note => note.id === noteId);
        if (noteIndex === -1) {
          return res.status(404).json({ error: 'Note not found' });
        }
        notes[noteIndex].content = content;
        break;
      case 'delete':
        notes = notes.filter(note => note.id !== noteId);
        break;
      case 'get':
        return res.json(notes);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    await fs.writeFile(userNotesFile, JSON.stringify(notes));
    res.json({ success: true, notes });
  } catch (error) {
    console.error('Error handling note operation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Mini app server running on port ${port}`);
});

// Handle incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  await getUserInfo(chatId);

  if (msg.text && msg.text.toLowerCase() === 'hello') {
    bot.sendMessage(chatId, 'Hello! Use /start to view your profile mini app.');
  }
});

console.log('Bot is running...');

// Mini App HTML
const miniAppHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Enhanced Profile Mini App</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        :root {
            --primary-color: #0088cc;
            --secondary-color: #006699;
            --background-color: #f0f2f5;
            --card-background: white;
            --text-color: #333;
            --text-muted: #666;
        }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--background-color);
            color: var(--text-color);
            transition: background-color 0.3s ease, color 0.3s ease;
        }
        .profile-card {
            background-color: var(--card-background);
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            margin: 0 auto;
            transition: background-color 0.3s ease;
        }
        .profile-picture {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            margin: 0 auto 20px;
            display: block;
        }
        h1, h2 {
            text-align: center;
            color: var(--text-color);
        }
        .info-item {
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
        }
        .info-label {
            font-weight: bold;
            color: var(--text-muted);
        }
        .info-value {
            color: var(--text-color);
        }
        .button {
            display: block;
            width: 100%;
            padding: 10px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
            transition: background-color 0.3s ease;
        }
        .button:hover {
            background-color: var(--secondary-color);
        }
        .tools {
            margin-top: 20px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        .tool-button {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px;
            background-color: var(--card-background);
            border: 1px solid var(--primary-color);
            border-radius: 5px;
            color: var(--primary-color);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .tool-button:hover {
            background-color: var(--primary-color);
            color: white;
        }
        .tool-button svg {
            margin-right: 5px;
        }
        .tool-content {
            display: none;
            margin-top: 20px;
            padding: 10px;
            background-color: var(--card-background);
            border: 1px solid var(--primary-color);
            border-radius: 5px;
        }
        .tool-content.active {
            display: block;
        }
        #colorPicker {
            width: 100%;
            height: 40px;
        }
        #qrContent {
            width: 100%;
            margin-bottom: 10px;
        }
        #notes {
            width: 100%;
            height: 100px;
            margin-bottom: 10px;
        }
        #calc {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
        }
        #calc button {
            padding: 10px;
        }
        #calc input {
            grid-column: span 4;
            padding: 10px;
            margin-bottom: 5px;
        }
        .theme-toggle {
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 24px;
        }
        body.dark-theme {
            --background-color: #1c2733;
            --card-background: #22303c;
            --text-color: #ffffff;
            --text-muted: #a0aec0;
        }
        .note-list {
            margin-top: 10px;
        }
        .note-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        .note-content {
            flex-grow: 1;
            margin-right: 10px;
        }
        .note-actions {
            display: flex;
            gap: 5px;
        }
        .note-actions button {
            padding: 5px 10px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">🌓</button>
    <main class="profile-card">
        <img src="__USER_PHOTO_URL__" alt="Profile Picture" class="profile-picture" id="profilePicture">
        <h1 id="userName">__USER_FIRST_NAME__ __USER_LAST_NAME__</h1>
        <div class="info-item">
            <span class="info-label">User ID:</span>
            <span class="info-value" id="userId">__USER_ID__</span>
        </div>
        <div class="info-item">
            <span class="info-label">Username:</span>
            <span class="info-value" id="userUsername">__USER_USERNAME__</span>
        </div>
        <div class="info-item">
            <span class="info-label">Language:</span>
            <span class="info-value" id="userLanguage">__USER_LANGUAGE__</span>
        </div>
        <div class="info-item">
            <span class="info-label">Premium:</span>
            <span class="info-value" id="userPremium">__USER_PREMIUM__</span>
        </div>
        <div class="info-item">
            <span class="info-label">Theme:</span>
            <span class="info-value" id="userTheme"></span>
        </div>
        <button class="button" id="shareButton">Share Profile</button>
        
        <h2>Tools</h2>
        <div class="tools">
            <button class="tool-button" id="colorPickerButton">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="13.5" cy="6.5" r=".5"/>
                    <circle cx="17.5" cy="10.5" r=".5"/>
                    <circle cx="8.5" cy="7.5" r=".5"/>
                    <circle cx="6.5" cy="12.5" r=".5"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                </svg>
                Color Picker
            </button>
            <button class="tool-button" id="qrGeneratorButton">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                </svg>
                QR Generator
            </button>
            <button class="tool-button" id="notesButton">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
                Notes
            </button>
            <button class="tool-button" id="calculatorButton">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2"/>
                    <line x1="8" y1="6" x2="16" y2="6"/>
                    <line x1="16" y1="14" x2="16" y2="18"/>
                    <line x1="8" y1="14" x2="8" y2="18"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="8" y1="10" x2="16" y2="10"/>
                </svg>
                Calculator
            </button>
        </div>
        <div id="colorPickerTool" class="tool-content">
            <input type="color" id="colorPicker">
            <p id="selectedColor"></p>
        </div>
        <div id="qrGeneratorTool" class="tool-content">
            <input type="text" id="qrContent" placeholder="Enter text for QR code">
            <button id="generateQR" class="button">Generate QR Code</button>
            <div id="qrCode"></div>
        </div>
        <div id="notesTool" class="tool-content">
            <textarea id="noteContent" placeholder="Write your note here"></textarea>
            <button id="saveNote" class="button">Save Note</button>
            <div id="noteList" class="note-list"></div>
        </div>
        <div id="calculatorTool" class="tool-content">
            <div id="calc">
                <input type="text" id="result" readonly>
                <button>7</button>
                <button>8</button>
                <button>9</button>
                <button>/</button>
                <button>4</button>
                <button>5</button>
                <button>6</button>
                <button>*</button>
                <button>1</button>
                <button>2</button>
                <button>3</button>
                <button>-</button>
                <button>0</button>
                <button>.</button>
                <button>=</button>
                <button>+</button>
            </div>
        </div>
    </main>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script>
        const tg = window.Telegram.WebApp;

        document.addEventListener('DOMContentLoaded', () => {
            tg.expand();

            const userId = document.getElementById('userId').textContent;

            // Theme toggle functionality
            const themeToggle = document.getElementById('themeToggle');
            const body = document.body;
            const userThemeSpan = document.getElementById('userTheme');

            function setTheme(isDark) {
                if (isDark) {
                    body.classList.add('dark-theme');
                    userThemeSpan.textContent = 'Dark';
                    themeToggle.textContent = '☀️';
                } else {
                    body.classList.remove('dark-theme');
                    userThemeSpan.textContent = 'Light';
                    themeToggle.textContent = '🌙';
                }
            }

            // Set initial theme based on Telegram's color scheme
            const initialColorScheme = tg.colorScheme;
            setTheme(initialColorScheme === 'dark');

            themeToggle.addEventListener('click', () => {
                const isDark = body.classList.toggle('dark-theme');
                setTheme(isDark);
            });

            // Share button functionality
            document.getElementById('shareButton').addEventListener('click', () => {
                tg.sharePhone();
            });

            // Tool button functionalities
            const tools = ['colorPicker', 'qrGenerator', 'notes', 'calculator'];
            tools.forEach(tool => {
                document.getElementById(\`\${tool}Button\`).addEventListener('click', () => {
                    tools.forEach(t => {
                        document.getElementById(\`\${t}Tool\`).classList.remove('active');
                    });
                    document.getElementById(\`\${tool}Tool\`).classList.add('active');
                    if (tool === 'notes') {
                        loadNotes();
                    }
                });
            });

            // Color Picker
            const colorPicker = document.getElementById('colorPicker');
            const selectedColor = document.getElementById('selectedColor');
            colorPicker.addEventListener('input', (e) => {
                selectedColor.textContent = \`Selected color: \${e.target.value}\`;
                selectedColor.style.color = e.target.value;
            });

            // QR Generator
            const qrContent = document.getElementById('qrContent');
            const generateQR = document.getElementById('generateQR');
            const qrCode = document.getElementById('qrCode');
            generateQR.addEventListener('click', () => {
                qrCode.innerHTML = '';
                new QRCode(qrCode, qrContent.value);
            });

            // Notes
            const noteContent = document.getElementById('noteContent');
            const saveNote = document.getElementById('saveNote');
            const noteList = document.getElementById('noteList');

            function loadNotes() {
                fetch('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, action: 'get' })
                })
                .then(response => response.json())
                .then(notes => {
                    noteList.innerHTML = '';
                    notes.forEach(note => {
                        const noteElement = document.createElement('div');
                        noteElement.className = 'note-item';
                        noteElement.innerHTML = \`
                            <span class="note-content">\${note.content}</span>
                            <div class="note-actions">
                                <button class="edit-note">Edit</button>
                                <button class="delete-note">Delete</button>
                            </div>
                        \`;
                        noteList.appendChild(noteElement);

                        noteElement.querySelector('.edit-note').addEventListener('click', () => {
                            noteContent.value = note.content;
                            saveNote.textContent = 'Update Note';
                            saveNote.dataset.noteId = note.id;
                        });

                        noteElement.querySelector('.delete-note').addEventListener('click', () => {
                            deleteNote(note.id);
                        });
                    });
                });
            }

            function saveNoteToServer(content, noteId = null) {
                const action = noteId ? 'update' : 'create';
                fetch('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, action, noteId, content })
                })
                .then(response => response.json())
                .then(() => {
                    loadNotes();
                    noteContent.value = '';
                    saveNote.textContent = 'Save Note';
                    delete saveNote.dataset.noteId;
                });
            }

            function deleteNote(noteId) {
                fetch('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, action: 'delete', noteId })
                })
                .then(response => response.json())
                .then(() => {
                    loadNotes();
                });
            }

            saveNote.addEventListener('click', () => {
                const content = noteContent.value.trim();
                if (content) {
                    saveNoteToServer(content, saveNote.dataset.noteId);
                }
            });

            // Calculator
            const calc = document.getElementById('calc');
            const result = document.getElementById('result');
            calc.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const value = e.target.textContent;
                    if (value === '=') {
                        try {
                            result.value = eval(result.value);
                        } catch (error) {
                            result.value = 'Error';
                        }
                    } else {
                        result.value += value;
                    }
                }
            });
        });
    </script>
</body>
</html>
`;
