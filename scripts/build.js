const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const postsDir = path.join(__dirname, '../_posts');
const outputDir = path.join(__dirname, '../posts');
const dataDir = path.join(__dirname, '../assets/data');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const posts = [];

const files = fs.readdirSync(postsDir);

files.forEach(file => {
    if (!file.endsWith('.md')) return;

    const filePath = path.join(postsDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContent);

    // Skip posts with ! prefix if they are meant to be hidden (as seen in the file list)
    // Actually, let's include all for now unless they are drafts.

    const date = data.date || file.substring(0, 10);
    const title = data.title || file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    const slug = file.replace(/\.md$/, '');
    const url = `/posts/${slug}.html`;

    posts.push({
        title,
        date,
        url,
        slug,
        excerpt: content.substring(0, 200).replace(/[#*`]/g, '') + '...'
    });

    // Convert MD to HTML
    const htmlContent = marked(content);
    const template = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ahh</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg">
        <div class="container">
            <a class="navbar-brand" href="/">ahh</a>
        </div>
    </nav>
    <main class="container mt-5">
        <article>
            <header class="mb-4">
                <h1 class="fw-bold">${title}</h1>
                <p class="text-muted">${date}</p>
            </header>
            <div class="content">
                ${htmlContent}
            </div>
        </article>
    </main>
    <footer class="footer mt-auto py-3 text-center">
        <div class="container">
            <span class="text-muted">© 2024 ahh</span>
        </div>
    </footer>
</body>
</html>`;

    fs.writeFileSync(path.join(outputDir, `${slug}.html`), template);
});

// Sort posts by date descending
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

fs.writeFileSync(path.join(dataDir, 'posts.json'), JSON.stringify(posts, null, 2));

console.log(`Generated ${posts.length} posts.`);
