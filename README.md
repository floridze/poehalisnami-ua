# Vadym Varianytsia

Односторінковий статичний проєкт на Vite та SCSS.

## Команди

```bash
npm install
npm run dev
```

`npm run dev` запускає Vite dev server для розробки.

```bash
npm run build
```

`npm run build` створює звичайну production-збірку в папці `site`. Це канонічний Vite build для перегляду через localhost, nginx або `npm run preview`.

```bash
npm run build:local
```

`npm run build:local` спочатку збирає `site`, а потім створює `site-local`. Цю папку можна передати людині, яка просто відкриє `site-local/index.html` подвійним кліком.

```bash
npm run preview
```

`npm run preview` підіймає локальний сервер для перевірки папки `site`.

## Збірки

- `site` - звичайна production-збірка для розробника та перегляду через сервер.
- `site-local` - версія для відкриття через `file://`; CSS, JS, шрифти, іконки та SVG-спрайт інлайняться в HTML.

## Шрифти

У проєкті використовується локальний `Open Sans` через пакет `@fontsource-variable/open-sans`.

Підключені latin і cyrillic variable font-файли з діапазоном ваги `300-700`. У production-збірці шрифти потрапляють у `site/assets/fonts`, а у `site-local` інлайняться в HTML як `data:font/woff2`, щоб сторінка відкривалася через `file://` без CORS-помилок.

## Зображення

Вихідні зображення лежать у `src/images`. Після production-збірки вони копіюються в `site/assets/images` та оптимізуються скриптом `scripts/optimize-images.js`.

Для raster-зображень у форматах `.jpg`, `.jpeg` і `.png` під час збірки додатково створюються `.webp`-версії. У production HTML теги `<img>` автоматично обгортаються в `<picture>`:

```html
<picture>
  <source srcset="./assets/images/example.webp" type="image/webp">
  <img src="./assets/images/example.png" alt="">
</picture>
```

Так браузер отримує WebP, якщо підтримує його, а оригінальний формат залишається fallback.
