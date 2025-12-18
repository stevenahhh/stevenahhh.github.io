const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, '../_posts');
const outputFile = path.join(__dirname, '../assets/data/posts.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const data = {};
  yaml.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(':').trim();
      data[key] = value;
    }
  });
  return data;
}

function updatePosts() {
  if (!fs.existsSync(postsDir)) {
    console.error('_posts directory not found');
    return;
  }

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  const posts = [];

  files.forEach(file => {
    if (file.startsWith('!')) return;

    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const metadata = parseFrontmatter(content);

    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
    let dateStr = metadata.date || (dateMatch ? dateMatch[1] : '');

    // Clean date for sorting (YYYY-MM-DD)
    const cleanDate = dateStr.split(' ')[0];
    const year = cleanDate ? cleanDate.substring(0, 4) : 'Unknown';

    posts.push({
      id: file.replace('.md', ''),
      title: metadata.title || file.replace('.md', ''),
      date: cleanDate,
      fullDate: dateStr,
      year: year,
      url: `/post.html?id=${file.replace('.md', '')}`
    });
  });

  // Sort by date descending
  posts.sort((a, b) => {
    const dateA = new Date(a.date || '1970-01-01');
    const dateB = new Date(b.date || '1970-01-01');
    return dateB - dateA;
  });

  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(posts, null, 2));
  console.log(`Successfully updated ${posts.length} posts in posts.json`);
}

updatePosts();
