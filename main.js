// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('./server'); // Assuming your server code is in server.js

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadURL('http://localhost:3000'); // Load your Express server
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('load-page', (event, page) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        switch (page) {
            case 'captain':
                win.loadURL('http://localhost:3000/captain.html');
                break;
            case 'admin':
                win.loadURL('http://localhost:3000/admin.html');
                break;
            case 'login':
                win.loadURL('http://localhost:3000/');
                break;
            default:
                console.error('Unknown page:', page);
        }
    }
});

// Add this new IPC handler for printing
ipcMain.on('print-to-pdf', (event, htmlContent) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.webContents.printToPDF({}).then(data => {
            event.reply('wrote-pdf', data);
        }).catch(error => {
            event.reply('error', error);
        });
    }
});
