import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE_URL = 'https://muuu-noir.github.io/mysite';
const POSTS_DIR = path.join(__dirname, 'blog', 'posts');
const TEMPLATE_PATH = path.join(__dirname, 'blog', '_template.html');
const OUTPUT_DIR = path.join(__dirname, 'blog');
const INDEX_JSON_PATH = path.join(OUTPUT_DIR, 'index.json');
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const OG_OUTPUT_DIR = path.join(__dirname, 'img', 'blog', 'og');

// Register Noto Sans JP if available locally, otherwise use system fallback
const FONT_PATHS = [
    path.join(__dirname, 'fonts', 'NotoSansJP-Bold.ttf'),
    path.join(__dirname, 'fonts', 'NotoSansJP-Regular.ttf'),
];
let fontFamily = 'sans-serif';
if (fs.existsSync(FONT_PATHS[0])) {
    GlobalFonts.registerFromPath(FONT_PATHS[0], 'NotoSansJP');
    fontFamily = 'NotoSansJP';
}
if (fs.existsSync(FONT_PATHS[1])) {
    GlobalFonts.registerFromPath(FONT_PATHS[1], 'NotoSansJP');
}

/**
 * Generate OGP image for a blog article
 */
function generateOgImage(slug, title, dateFormatted, category, stat) {
    const WIDTH = 1200;
    const HEIGHT = 630;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Dark background matching site
    ctx.fillStyle = '#0B0E14';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stat watermark — huge, faded, behind everything
    if (stat) {
        const statFontSize = Math.min(220, Math.floor(1600 / stat.length));
        ctx.font = `300 ${statFontSize}px "${fontFamily}", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.05;
        ctx.fillText(stat, WIDTH / 2, HEIGHT / 2);
        ctx.globalAlpha = 1.0;
    }

    // Thin indigo border frame
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(48, 48, WIDTH - 96, HEIGHT - 96);

    // Logo (top-left inside frame)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `300 22px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('396 FOLIO', 72, 72);

    // Title (centered, thin weight)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `300 50px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = WIDTH - 200;
    const lines = wrapText(ctx, title, maxWidth);
    const lineHeight = 70;
    const totalHeight = lines.length * lineHeight;
    const startY = (HEIGHT / 2) - (totalHeight / 2) + (stat ? 0 : 10);

    lines.forEach((line, i) => {
        ctx.fillText(line, WIDTH / 2, startY + i * lineHeight);
    });

    // Category (bottom-center, indigo)
    ctx.font = `300 18px "${fontFamily}", sans-serif`;
    ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const bottomText = category ? `${category.toUpperCase()}  ·  ${dateFormatted}` : dateFormatted;
    ctx.fillText(bottomText, WIDTH / 2, HEIGHT - 68);

    // Save PNG
    fs.mkdirSync(OG_OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OG_OUTPUT_DIR, `${slug}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated OG image: img/blog/og/${slug}.png`);

    return `${SITE_URL}/img/blog/og/${slug}.png`;
}

/**
 * Wrap text into lines that fit within maxWidth
 */
function wrapText(ctx, text, maxWidth) {
    const chars = Array.from(text);
    const lines = [];
    let currentLine = '';

    for (const char of chars) {
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = char;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }

    // Limit to 4 lines max, truncate with ellipsis
    if (lines.length > 4) {
        lines.length = 4;
        lines[3] = lines[3].slice(0, -1) + '...';
    }

    return lines;
}

// Read template
const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

// Collect all markdown files
const mdFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

if (mdFiles.length === 0) {
    console.log('No markdown files found in blog/posts/');
    process.exit(0);
}

const articles = [];

for (const file of mdFiles) {
    const filePath = path.join(POSTS_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: fm, content } = matter(raw);

    const slug = file.replace(/\.md$/, '');
    const htmlFilename = slug + '.html';
    const articleUrl = `${SITE_URL}/blog/${htmlFilename}`;

    // Format date
    const date = new Date(fm.date);
    const dateISO = date.toISOString().split('T')[0];
    const dateFormatted = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

    // Calculate reading time (Japanese: ~500 chars/min)
    const plainText = content.replace(/[#*\[\]()>`_~\-|]/g, '').replace(/\s+/g, '');
    const readingMinutes = Math.max(1, Math.round(plainText.length / 500));
    const readingTime = `約${readingMinutes}分`;

    // Convert markdown to HTML
    const htmlContent = marked(content);

    // Build JSON-LD for Article
    const jsonld = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': fm.title,
        'datePublished': dateISO,
        'dateModified': dateISO,
        'author': {
            '@type': 'Person',
            'name': '手塚桃子',
            'url': SITE_URL + '/'
        },
        'description': fm.description || '',
        'image': fm.image ? `${SITE_URL}/${fm.image}` : `${SITE_URL}/img/profile/profile_avatar.png`,
        'url': articleUrl,
        'publisher': {
            '@type': 'Person',
            'name': '手塚桃子',
            'logo': {
                '@type': 'ImageObject',
                'url': `${SITE_URL}/img/profile/profile_avatar.png`
            }
        }
    }, null, 8);

    // OG image: use frontmatter image if specified, otherwise auto-generate
    let ogImage;
    if (fm.image) {
        ogImage = `${SITE_URL}/${fm.image}`;
    } else {
        ogImage = generateOgImage(slug, fm.title, dateFormatted, fm.category || '', fm.stat || '');
    }

    // Fill template
    let html = template
        .replace(/\{\{title\}\}/g, fm.title)
        .replace(/\{\{description\}\}/g, fm.description || '')
        .replace(/\{\{url\}\}/g, articleUrl)
        .replace(/\{\{ogImage\}\}/g, ogImage)
        .replace(/\{\{dateISO\}\}/g, dateISO)
        .replace(/\{\{dateFormatted\}\}/g, dateFormatted)
        .replace(/\{\{category\}\}/g, fm.category || '')
        .replace(/\{\{readingTime\}\}/g, readingTime)
        .replace(/\{\{content\}\}/g, htmlContent)
        .replace(/\{\{jsonld\}\}/g, jsonld);

    // Write HTML
    const outputPath = path.join(OUTPUT_DIR, htmlFilename);
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`Generated: blog/${htmlFilename}`);

    // Add to index
    articles.push({
        slug,
        title: fm.title,
        date: dateISO,
        dateFormatted,
        category: fm.category || '',
        description: fm.description || '',
        image: fm.image || `img/blog/og/${slug}.png`,
        url: `blog/${htmlFilename}`
    });
}

// Sort by date descending
articles.sort((a, b) => b.date.localeCompare(a.date));

// Write index.json
fs.writeFileSync(INDEX_JSON_PATH, JSON.stringify(articles, null, 2), 'utf-8');
console.log(`Generated: blog/index.json (${articles.length} articles)`);

// Update sitemap.xml
updateSitemap(articles);

function updateSitemap(articles) {
    let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf-8');

    // Remove any existing blog entries
    sitemap = sitemap.replace(/\s*<!-- blog-start -->[\s\S]*?<!-- blog-end -->/g, '');

    // Build blog entries
    const blogEntries = articles.map(a => `  <url>
    <loc>${SITE_URL}/blog/${a.slug}.html</loc>
    <lastmod>${a.date}</lastmod>
    <priority>0.7</priority>
  </url>`).join('\n');

    const blogBlock = `\n  <!-- blog-start -->\n${blogEntries}\n  <!-- blog-end -->`;

    // Insert before </urlset>
    sitemap = sitemap.replace('</urlset>', `${blogBlock}\n</urlset>`);

    fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf-8');
    console.log('Updated: sitemap.xml');
}

console.log('\nBuild complete!');
