const fs = require('fs');
const path = require('path');

function removeComments(content) {
    // Regex to match strings (double, single, backtick) OR comments (multi-line, single-line)
    // Group 1: Double quoted string
    // Group 2: Single quoted string
    // Group 3: Backtick string
    // Group 4: Multi-line comment
    // Group 5: Single-line comment
    const regex = /("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/)|(\/\/.*)/g;

    return content.replace(regex, (match, doubleQuote, singleQuote, backtick, multiLine, singleLine) => {
        if (doubleQuote || singleQuote || backtick) {
            // It's a string, preserve it
            return match;
        }
        // It's a comment, remove it
        // For single line comments, we might want to keep the newline if it was part of the match, 
        // but usually // matches until end of line (excluding newline), so replacing with empty string is fine.
        return '';
    });
}

function processFile(filePath) {
    try {
        const fullPath = path.resolve(filePath);
        if (!fs.existsSync(fullPath)) {
            console.error(`File not found: ${fullPath}`);
            return;
        }

        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            const files = fs.readdirSync(fullPath);
            files.forEach(file => processFile(path.join(fullPath, file)));
            return;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        const newContent = removeComments(content);

        if (content !== newContent) {
            fs.writeFileSync(fullPath, newContent, 'utf8');
            console.log(`Processed: ${fullPath}`);
        } else {
            console.log(`No comments found/changed: ${fullPath}`);
        }

    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log("Usage: node remove_comments.js <file_or_directory>");
    process.exit(1);
}

args.forEach(arg => processFile(arg));
