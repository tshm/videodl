module.exports = {
    "globals": {
        "cd": true,
        "echo": true,
        "exit": true,
        "grep": true,
        "exec": true
    },
    "rules": {
        "no-console": 0,
        "indent": [
            2,
            "tab"
        ],
        "quotes": [
            2,
            "single"
        ],
        "linebreak-style": [
            2,
            "unix"
        ],
        "semi": [
            2,
            "never"
        ]
    },
    "env": {
        "es6": true,
        "node": true,
        "browser": false
    },
    "extends": "eslint:recommended"
};
