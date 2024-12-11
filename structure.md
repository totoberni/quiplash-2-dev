/root
├── app.js
├── app.yaml
├── .gitignore
├── node_modules
├── package-lock.json
├── package.json
├── Procfile
├── .env
├── public
│   ├── game.js
│   └── ... (other static assets like CSS, images, etc.)
├── server
│   ├── controllers
│   |    ├── authController.js
│   |    └── gameController.js
|   ├── models
│   |    └── playerModel.js
│   └── utils
|         ├── apiUtils.js
|         ├── socketUtils.js
|         ├── playerManager.js
|         ├── sessionStore.js
│         └── gameLogic.js
├── testing
|    ├── .venv (virtual environment scripts and packages)
|    ├── requirements.txt
|    ├── test_app.py
|    └── test_app_even.py
└── views
    ├── chat.ejs
    ├── client.ejs
    ├── display.ejs
    ├── footer.ejs
    └── header.ejs