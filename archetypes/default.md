---
title: "{{ replace .Name "-" " " | title }}"
# El slug de abajo se genera solo del nombre del archivo, quitándole
# automáticamente un prefijo de fecha si lo pusiste (ej. si nombras el
# archivo "2026-09-08-htb-writeup-nuevo.md", el slug sale como
# "htb-writeup-nuevo", sin la fecha) -- así puedes seguir nombrando tus
# archivos con fecha al inicio para ubicarte más fácil en el editor,
# sin que eso afecte la URL real del post. Si el nombre del archivo NO
# lleva slug, ajusta esta línea a mano antes de publicar.
slug: "{{ replaceRE "^[0-9]{4}-[0-9]{2}-[0-9]{2}-" "" .Name }}"
# Deja `date:` como la fecha real en que subes/escribes este post --
# controla dónde aparece cronológicamente en Inicio, Writeups,
# Categorías, etc. NO la uses para "cuándo se libera": eso es
# unlock_date (ver abajo). Si algún día pones aquí una fecha
# genuinamente futura, el post ni siquiera existirá en el sitio hasta
# esa fecha (por buildFuture en hugo.toml) -- normalmente no es lo que
# quieres para un writeup embargado.
date: {{ .Date }}
# Opcional. Si esta máquina AÚN sigue activa en HTB/THL, pon aquí la
# fecha en la que planeas que se libere/retire (ej. unlock_date:
# 2026-11-20). Mientras esa fecha no llegue, la página de este post
# muestra un candado en vez del writeup completo -- pero el post
# igual aparece en su lugar cronológico normal (por su `date:` real)
# en Inicio, Writeups, Categorías, etc., mostrando el mensaje de
# "Próximamente" ahí también. Borra esta línea (o déjala vacía) si el
# writeup no necesita candado.
# unlock_date: 2026-11-20
draft: true
excerpt: ""
categories: []
tags: []
# Separa tus herramientas por dónde las ejecutas. Si dejas ambas vacías y
# usas `tools: [...]` (formato viejo), el theme sigue mostrándolas juntas.
tools_kali: []
tools_target: []
links: []
showtoc: true
header:
  teaser: "/assets/images/POST-SLUG/portada.png"
---

Introducción del writeup aquí.

## Recopilación de información

### Descubrimiento de hosts

Contenido...

## Análisis de vulnerabilidades

## Explotación de vulnerabilidades

## Post explotación
