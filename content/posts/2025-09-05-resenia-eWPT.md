---
title: "Reseña - Certificación eWPTv2"
date: 2025-09-05
draft: false
slug: "resenia-eWPT"
excerpt: "Esta es una reseña (sin muchos spoilers) sobre el examen para la certificación eWPTv2. Explicaré un poco de qué trata la certificación, cómo fue el curso de preparación que imparte INE Security junto a mi opinión sobre este, y una reseña del examen que me toco realizar. Además, añadiré algunos tips y consejos que te pueden ser útiles para realizar el examen. Si vas a aplicar el examen, ¡mucha suerte y éxito!."
categories: ["Certifications"]
tags: ["eWPTv2", "Reseña Certificación", "Consejos"]
tools: []
links:
  - "https://ine.com/security/certifications/ewpt-certification"
  - "https://academy.hackthebox.com/path/preview/bug-bounty-hunter"
  - "https://portswigger.net/web-security/learning-paths"
  - "https://thehackerslabs.com/"
showtoc: true
header:
  teaser: "/assets/images/resenia-ewpt/ewpt3.png"
---

## ¿Qué es la Certificación eWPTv2? {#eWPTv2}

Primero que nada, ¿Qué es la **certificación eWPT**?

| **Certificación eLearnSecurity Web Application Penetration Tester (eWPT)** |
|:-----------:|
| *La certificación eWPT de INE Security está dirigida a pentesters de nivel profesional y valida que la persona cuenta con los conocimientos, habilidades y capacidades necesarios para desempeñar el papel de pentester de aplicaciones web. Este examen está diseñado para ser una certificación importante para alguien con experiencia básica en pruebas de penetración de aplicaciones web, simulando las habilidades utilizadas durante una intervención en el mundo real. Este examen demuestra realmente que el candidato tiene lo que se necesita para formar parte de un equipo de pruebas de penetración de alto rendimiento.* |

La versión actual, que es la **versión 2**, consta de responder un cuestionario de 50 preguntas con un límite de 10 horas. Dichas preguntas, obtendrás la respuesta mientras aplicas pruebas de penetración web a las máquinas que te toquen en tu examen.

La **versión 1** de esta certificación, constaba de vulnerar un laboratorio aplicando pruebas de penetración web, con tiempo límite de 7 días, y luego, tenías que realizar un reporte sobre el laboratorio asignado, con tiempo límite de 7 días, dando un total de 14 días de duración de esta certificación.

Cambió muchísimo al igual que la **certificación eCPPTv3**, pasando de realizar un reporte a responder un cuestionario.

Aquí puedes encontrar más información sobre la **certificación eWPTv2**:
* <a href="https://ine.com/security/certifications/ewpt-certification" target="_blank">INE Security - eWPT Certification</a>

## Reseña del Curso de Preparación {#Curso}

Quien imparte el curso, es el master **Alexis Ahmed**, por lo que tendrás una buena experiencia a través del curso.

El curso de preparación consta de 10 sección (12 si incluimos la introducción y conclusión, pero no las incluire):

**Sección 1: Introduction to Web App Security Testing (Introducción a las pruebas de seguridad de aplicaciones web)**
* *Introduction To Web Application Security (Introducción a Seguridad en Aplicaciones Web)*
* *Web Application Security Testing (Pruebas de Seguridad de Aplicaciones Web)*
* *Common Web Application Threats & Risks (Amenazas y Riesgos Comunes de las Aplicaciones Web)*
* *Web Application Architecture (Arquitectura de Aplicaciones Web)*
* *Web Application Technologies (Tecnologías de Aplicaciones Web)*
* *Introduction To HTTP (Introducción a HTTP)*
* *HTTP Requests (Peticiones HTTP)*
* *HTTP Responses (Respuestas HTTP)*
* *HTTP Basics Lab (Laboratorio Básico de HTTP)*
* *HTTPS*
* *Web App Pentesting Methodology (Metodología para Pentesting en Web Apps)*
* *OWASP Top 10*
* *OWASP Web Security Testing Guide (WSTG)*
* *Pre-Engagement Phase (Fase Previa al Compromiso)*
* *Documenting & Communicating Findings (Documentación y Comunicando Hallazgos)*

En general, se trata de una introducción a aplicaciones web. La parte más importante es cuando explica el framework **OWASP Top 10**, que es clave cuando aplicamos pentest web.

**Sección 2: Web Enumeration & Information Gathering (Recopilación de Información y Enumeración Web)**
* *Introduction To Web Enumeration & Information Gathering (Introducción a la Enumeración Web y Recopilación de Información)*
* *OWASP Web Security Testing Guide*
* *WHOIS*
* *Website Fingerprinting With Netcraft (Huellas Digitales de Sitios Web con Netcraft)*
* *Passive DNS Enumeration (Enumeración DNS Pasiva)*
* *Reviewing Webserver Metafiles (Revisión de los Metaficheros del Servidor Web)*
* *Google Dorks*
* *Web App Technology Fingerprinting (Huella Digital en Tecnologías de Aplicaciones Web)*
* *WAF Detection (Detección de WAF)*
* *Copying A Website With HTTRack (Copiando un Sitio Web con HTTRack)*
* *Website Screenshots With EyeWitness (Capturas de Pantalla de Sitios Web con EyeWitness)*
* *Passive Crawling & Spidering With Burp Suite & OWASP ZAP (Rastreo Pasivo y Spidering con Burp Suite y OWASP ZAP)*
* *Web Server Fingerprinting (Huella Digital del Servidor Web)*
* *DNS Zone Transfers (Transferencia de Zona en DNS)*
* *Subdomain Enumeration (Enumeración de Subdominios)*
* *Web Server Scanning With Nikto (Escaneo de Servidores Web con Nikto)*
* *File & Directory Brute-Force (Fuerza Bruta a Archivos y Directorios Web)*
* *Automated Web Recon With OWASP Amass (Reconocimiento Web Automatizado con OWASP Amass)*

Esta sección tiene contenido similar al **curso del eCPPTv3**. Bastante buena en cuanto a enseñar cómo puedes ir recopilando información de aplicaciones web, utilizando herramientas variadas o de forma manual. De igual forma, explica muy bien cómo aplicar enumeración web, siendo lo más destacado el cómo puedes aplicar **Fuzzing** para descubrir archivos y directorios ocultos o subdominios.

**Sección 3: WAPT: Web Proxies and Web Information Gathering (Web Proxies y Recopilación de Información)**
* *Introduction To Web Proxies (Introducción a los Web Proxies)*
* *Introduction To Burp Suite (Introducción a Burp Suite)*
* *Configuring The Burp Proxy (Configurando Burp Proxy)*
* *Burp Suite Dashboard & UI*
* *Burp Suite Target & Scope (Objetivo y Alcance en Burp Suite)*
* *Passive Crawling With Burp Suite (Rastreo Pasivo con Burp Suite)*
* *Burp Suite Intruder*
* *Attacking Basic Auth With Intruder & Encoder (Ataque a la Autenticación básica con Intruder y Encoder)*
* *Burp Suite Repeater*
* *Introduction To OWASP ZAP (Introducción a OWASP ZAP)*
* *OWASP ZAP Dashboard & UI*
* *Configuring The OWASP ZAP Proxy (Configuración del Proxy OWASP ZAP)*
* *OWASP ZAP Context & Scope (Contexto y Alcance de OWASP ZAP)*
* *Directory Enumeration With OWASP ZAP (Enumeración de Directorios con OWASP ZAP)*
* *Web App Scanning With OWASP ZAP (Análisis de Aplicaciones Web con OWASP ZAP)*
* *Spidering With OWASP ZAP (Spidering con OWASP ZAP)*
* *Attacking HTTP Login Forms With OWASP ZAP (Atacar Formularios de Inicio de Sesión HTTP con OWASP ZAP)*

De lo mejor del curso porque te enseña cómo usar **BurpSuite** y **OWASP ZAP** desde cero. Además, es un poco más completo en comparación con los cursos de **eCPPTv3** y **eJPTv2**.

**Sección 4: XSS Attacks (Ataques XSS)**
* *Introduction To Cross-Site Scripting (XSS) (Introducción a Cross-Site Scripting (XSS))*
* *Javascript Primer*
* *Anatomy Of A Cross-Site Scripting Attack (Anatomía de un Ataque Cross-Site Scripting (XSS)*
* *Introduction To Reflected XSS (Introducción a Reflected XSS)*
* *Exploiting Reflected XSS Vulnerabilities in WordPress (Explotación de Vulnerabilidades Reflected XSS en WordPress)*
* *Cookie Stealing Via Reflected XSS (Robo de Cookies Via Reflected XSS)*
* *Introduction To Stored XSS (Introducción a Stored XSS)*
* *Exploiting Stored XSS Vulnerabilities in MyBB Forum (Explotación de Vulnerabilidades Stored XSS en MyBB Forum)*
* *Introduction To DOM-Based XSS (Introducción a DOM-Based XSS)*
* *Exploiting DOM-Based XSS Vulnerabilities (Explotación de Vulnerabilidades DOM-Based XSS)*
* *Identifying & Exploiting XSS Vulnerabilities with XSSer (Identificación y Explotación de Vulnerabilidades XSS con XSSer)*

Bien explicado y simple para que puedas practicarlo en los laboratorios que te dan.

**Sección 5: SQL Injection Attacks (Ataques SQL Injection)**
* *Introduction To SQL Injection (Introducción a las SQL Injection)*
* *Anatomy of an SQL Injection Attack (Anatomía de un Ataque de SQL Injection)*
* *Types of SQL Injection Vulnerabilities (Tipos de Vulnerabilidades SQL Injection)*
* *Introduction To Databases & DBMS (Introducción a Bases de Datos y DBMS)*
* *Relational Databases vs NoSQL Databases (Bases de Datos Relacionales vs Bases de Datos NoSQL)*
* *Introduction To SQL (Introducción a SQL)*
* *SQL Fundamentals (Fundamentos de SQL)*
* *Hunting For SQL Injection Vulnerabilities (Cazando Vulnerabilidades SQL Injection)*
* *Finding SQL Injection Vulnerabilities Manually (Encontrando Vulnerabilidades SQL Injection Manualmente)*
* *Finding SQL Injection Vulnerabilities With OWASP ZAP (Encontrando Vulnerabilidades SQL Injection con OWASP ZAP)*
* *Exploiting Error-Based SQL Injection Vulnerabilities (Explotación de Vulnerabilidades de Inyección SQL Basadas en Errores)*
* *Exploiting Union-Based SQL Injection Vulnerabilities (Explotación de Vulnerabilidades de Inyección SQL Basadas en Union)*
* *Introduction To Boolean-Based SQL Injection Vulnerabilities (Introducción a las Vulnerabilidades Boolean-Based SQL Injection)*
* *Exploiting Boolean-Based SQL Injection Vulnerabilities (Explotación de Vulnerabilidades Boolean-Based SQL Injection)*
* *Exploiting Time-Based SQL Injection Vulnerabilities (Explotación de Vulnerabilidades Time-Based SQL Injection)*
* *NoSQL Fundamentals (Fundamentos de NoSQL)*
* *MongoDB NoSQL Injection (NoSQL Injection en MongoDB)*

En esta parte del curso, tengo una opinión dividida. Como tal, se enseña que es una **SQL Injection**, sus tipos y cómo aplicarlos, pero el problema es que en algunos videos el master **Alex Ahmed** parece tener algunos problemas para explicar y aplicar las **SQLi**, por lo que llega a confundir que es lo que está haciendo. Te recomiendo complementar este tema, con la academia de **PortSwigger** y con el módulo de **SQL Injections Fundamentals** de **HTB**.

**Sección 6: Testing For Common Attacks (Probando Ataques Comunes)**
* *HTTP Method Tampering (Manipulación de Método HTTP)*
* *Attacking Basic HTTP Authentication (Atacando Autenticación Básica de HTTP)*
* *Attacking HTTP Digest Authentication (Atacando la Autenticación Implícita (Digest) de HTTP)*
* *Sensitive Data Exposure Vulnerabilities (Vulnerabilidades de Exposición de Datos Confidenciales)*
* *Attacking Login Forms With Burp Suite (Atacando Formularios de Login con BurpSuite)*
* *Attacking Login Forms With OTP Security (Atacando Formularios de Login con OTP Security)*
* *Introduction To Session Management (Introducción a la Gestión de Sesiones)*
* *Session IDs & Cookies (IDs de Sesión y Cookies)*
* *Session Hijacking & Session Fixation (Secuestro de Sesión (Session Hijacking) y Fijación de la Sesión)*
* *Session Hijacking Via Cookie Tampering (Secuestro de Sesión Mediante Manipulación de Cookies)*
* *Introduction To Cross-Site Request Forgery (CSRF) (Introducción a Cross-Site Request Forgery (CSRF))*
* *Advanced Electron Forum CSRF (Foro de Electrónica Avanzada CSRF)*
* *Command Injection (Inyección de Comandos)*
* *PHP Code Injection (Inyección de Código PHP)*
* *RCE Via MySQL*

Otra sección que me gusto mucho del curso, pues la mayoria de los ataques se explican muy bien y los laboratorios son sencillos para que comprendas bien cada ataque.

**Sección 7: File & Resource Attacks (Ataques a Archivos y Recursos)**
* *Introduction To Arbitrary File Upload Vulnerabilities (Introducción a las Vulnerabilidades de Carga Arbitraria de Archivos)*
* *Exploiting Basic File Upload Vulnerabilities (Explotando Vulnerabilidades Básicas de Carga de Archivos)*
* *Bypassing File Upload Extension Filters (Eludiendo (Bypassing) Filtros de Extensión de Carga de Archivos)*
* *Bypassing PHPx Blacklists (Eludiendo (Bypassing) Listas Negras de PHPx)*
* *WordPress wpStoreCart File Upload (Carga de Archivos en WordPress wpStoreCart)*
* *Introduction To Directory Traversal (Introducción a Directory Traversal)*
* *Directory Traversal Basics (Básicos de Directory Traversal)*
* *OpenEMR Directory Traversal (Directory Traversal en OpenEMR)*
* *Introduction To Local File Inclusion (LFI) (Introducción a Local File Inclusion (LFI))*
* *Local File Inclusion Basics (Básicos de Local File Inclusion)*
* *WordPress IMDb Widget LFI (Aplicando LFI en Widget IMDb de WordPress)*
* *Introduction To Remote File Inclusion (RFI) (Introducción a Remote File Inclusion (RFI))*
* *Remote File Inclusion Basics (Básicos de Remote File Inclusion)*

Muy buena sección, al igual que la sección anterior, aunque me hubiera gustado que metieran más ejemplos de práctica.

**Sección 8: Web Service Security Testing (Pruebas de Seguridad de Servicios Web)**
* *Introduction To Web Services (Introducción a los Servicios Web)*
* *Web Services Vs APIs (Servicios Web vs APIs)*
* *Web Service Implementations (Implementación de Servicios Web)*
* *WSDL Language Fundamentals (Fundamentos del Lenguaje WSDL)*
* *Web Service Security Testing (Pruebas de Seguridad de Servicios Web)*
* *WSDL Disclosure & Method Enumeration (Divulgación de WSDL y Enumeración de Métodos)*
* *Invoking Hidden Methods (Invocación de Métodos Ocultos)*
* *Testing For SQL Injection (Probando Inyecciones SQL)*
* *Testing For Command Injection (Probando Inyección de Comandos)*

Aquí siento que falto bastante práctica y profundizar más en pentest a **APIs**, pues es mucha teoría y no hay muchos laboratorios. Tendrás que profundizar en esta parte con el módulo **Web Service & API Attacks y API Attacks** de **HackTheBox**

**Sección 9: CMS Security Testing (Pruebas de Seguridad de CMS)**
* *Introduction To CMS Security Testing (Introducción a Pruebas de Seguridad de CMS)*
* *Introduction To WordPress Security Testing (Introducción a Pruebas de Seguridad a WordPress)*
* *WordPress Version Enumeration (Enumeración de la Versión de WordPress)*
* *Enumerating WordPress Users, Plugins & Themes (Enumeración de Usuarios, Plugins y Temas de WordPress)*
* *Enumerating Hidden Files & Sensitive Information (Enumeración de Archivos Ocultos e Información Sensible de WordPress)*
* *WordPress Enumeration With Nmap NSE Scripts (Enumeración de WordPress con Scripts NSE de Nmap)*
* *WordPress Vulnerability Scan With WPScan (Escaneo de Vulnerabilidades de WordPress con WPScan)*
* *WordPress Brute-Force Attacks (Ataques de Fuerza Bruta a WordPress)*
* *WP Plugin - Arbitrary File Upload Vulnerability*
* *WP Plugin - Stored XSS Vulnerability (CVE-2020-9371)*
* *WordPress Black-Box Pentest*

En este caso, la sección se enfoca completamente en el **CMS WordPress**, que no está nada mal, pero debieron incluir otros **CMS** como **Joomla, Drupal**, etc y no solo enfocarse en **WordPress**. Aun así, esta sección es muy buena y completa en cuanto a aplicar un pentest a **WordPress**.

Te recomiendo el siguiente módulo de **HackTheBox**: **Attacking Common Applications y Hacking WordPress**.

**Sección 10: Encoding, Filtering & Evasion Basics (Fundamentos de Codificación, Filtrado y Evasión)**
* *Introduction To Encoding (Introducción a la Codificación)*
* *HTML Encoding (Codificación en HTML)*
* *URL Encoding (Codificación de URL)*
* *Base64 Encoding (Codificación de Base64)*
* *Introduction To Input Filtering (Introducción al Filtrado de Entrada)*
* *Bypassing Client-Side Filters (Bypassing Filtros del Lado del Cliente)*
* *Bypassing Server-Side Filters (Bypassing Filtros del Lado del Servidor)*
* *Bypassing XSS Filters In Chamilo LMS (Bypassing Filtros XSS en Chamilo LMS)*
* *Introduction To Evasion (Introducción a la Evasión)*
* *Bypassing Squid Proxy - Browser Based Restrictions (Bypassing Squid Proxy - Restricciones del Navegador)*

Bastante buena esta sección que enseña la codificación desde cero y cómo es posible aplicar algunos bypasses. Ni más ni menos, muy general.

El curso en sí es bastante completo, pero falla en algunos puntos como incluir más laboratorios de práctica, profundizar más en algunos temas e incluir algunos faltantes.

Es por eso que te recomiendo prepararte con recursos externos, aparte de este curso.

Más adelante, te proporciono los recursos que yo utilicé.

## Reseña del Examen {#Examen}

Una vez que obtienes el váucher de la certificación, cuentas con **180 días** para poder presentarlo, es decir, más o menos **6 meses**. Por lo que si compraste también el curso, que depende si usaste una promo y te dio 3 meses, tienes tiempo suficiente para hacer el curso y para practicar antes de presentar el examen.

El examen consta de **50 preguntas** (5 preguntas más que en el **eCPPTv3**) que deberás responder mientras haces tus pruebas de penetración web.

Esta vez, el examen dura solamente **10 horas** para que lo puedas resolver y tienes 2 chances para resolverlo, ósea, que si fallas 1 vez, puedes volver a presentar el examen.

Para aprobar el examen, debemos obtener el **70% dentro de todo el examen**, ya no es necesario que en todas las secciones tengas al menos el **70%** como antes.

El examen cubre los siguientes temas:

<p align="center">
<img src="/assets/images/resenia-ewpt/Captura1.png">
</p>

De igual forma que en el **examen del eJPT y eCPPT**, te dan algunos consejos que puedes tomar para aprobar el examen:

<p align="center">
<img src="/assets/images/resenia-ewpt/Captura2.png">
</p>

Con esto cubierto, vayamos a lo bueno.

A diferencia de otros exámenes, tienes muy poco tiempo para completarlo, por lo que tendrás que ser bastante rápido para hacer las pruebas necesarias, pero te lo digo que es el tiempo más que suficiente.

Lo malo es que tienes que usar forzosamente el laboratorio que te da **INE Security**, es decir, **NO** puedes usar tu propia máquina para resolver el examen.

Este laboratorio tiene muchos problemas de conexión, es bastante lento y las rutas de wordlists pueden variar a cómo lo tengas en tu máquina, por lo que ubicar las rutas correctas, te puede hacer perder un poco de tiempo.

Recuerda que no es un **CTF**, así que debes tener cuidado con los escaneos que realices, pues puedes tumbar alguna máquina.

Si eso pasa, te recomiendo reiniciar el laboratorio porque la máquina tumbada puede tardar en reiniciarse sola o, de plano, se quedará tumbada.

Eso sí, recuerda guardar todo tu avance y, si te piden obtener alguna flag de otra máquina, obtenla antes de reiniciar el laboratorio.

## Algunos Consejos y Links de Apoyo {#Consejos}

Te recomiendo encarecidamente que realices los siguientes cursos:

**Path de Bug Bounty Hunter de HackTheBox**

Aquí te dejo el link de la página:
* <a href="https://academy.hackthebox.com/path/preview/bug-bounty-hunter" target="_blank">HackTheBox Academy: Bug Bounty Hunter</a>

<p align="center">
<img src="/assets/images/resenia-ewpt/Captura3.png">
</p>

Este path se reparte en varios módulos con distintos costos de cubos de la **academia de HackTheBox**. Si tienes la oportunidad de comprar todos los módulos, aprovéchala y te ayudará también si es que en el futuro quieres hacer la **certificación CBBH** (ahora conocida como **CWES**) de **HackTheBox**.

**Academia de PortSwigger**

Aquí te dejo el link de la página:
* <a href="https://portswigger.net/web-security/learning-paths" target="_blank">PortSwigger: Learning Paths</a>

<p align="center">
<img src="/assets/images/resenia-ewpt/Captura4.png">
</p>

Super academia que incluso cubre más que el **Path de Bug Bounty Hunter de HackTheBox** y es totalmente gratis.

**Máquinas CTF de TheHackersLabs**

Aquí te dejo el link de la página:
* <a href="https://thehackerslabs.com/" target="_blank">TheHackersLabs</a>

<p align="center">
<img src="/assets/images/resenia-ewpt/Captura5.png">
</p>

Podrás encontrar muchas máquinas gratis que puedes descargar e instalar en **VirtualBox** o **VMware** para que puedas practicar.

Cada máquina tiene un write up hecho por su comunidad que puede serte de ayuda.

Por último, te doy algunos consejos para tu examen:

* **Consejo 1**: Por lo que sé, todos los exámenes son distintos, ninguno es igual, por lo que debes ir preparado por si te tocan distintas vulnerabilidades que estén o no dentro del alcance del examen. Pequeño spoiler, a mí no me tocó (o no identifiqué) ninguna **Inyección SQL**.

* **Consejo 2**: Las mismas preguntas, te pueden dar una pista sobre qué vulnerabilidades puedes aplicar en cada página/servidor web.

* **Consejo 3**: Lee muy bien la carta del examen donde se te dan el alcance del pentest, pues puede que te toque alguna pregunta relacionada con esta carta.

* **Consejo 4**: Ten preparado la guía de aplicación de **OWASP Top 10**, pues te pueden tocar algunas preguntas relacionadas con esto.

* **Consejo 5**: Te recomiendo mucho usar herramientas que automatizan la recopilación de información como **Nikto** o para identificar/explotar vulnerabilidades como **SQLMAP**, **Metasploit Framework**, etc. Más que nada por el corto tiempo que tienes.

* **Consejo 6**: Si conoces alguna herramienta que no esté dentro del laboratorio, puedes copiar y pegar su código para ejecutarla desde el laboratorio, solo verifica que no necesite algún paquete necesario que deba ser instalado para su uso, pues recuerda que no tendrás acceso a internet.

* **Consejo 7**: Anota todos los descubrimientos que hagas, ya sean rutas, credenciales de acceso, qué vulnerabilidades aplicaste, etc. Esto es para que tengas un orden de todo y no te pierdas durante tu examen.

* **Consejo 8**: Tómate todo el tiempo del examen si es necesario, recuerda que cada quien lleva su ritmo. Yo terminé el examen en **9:30 horas**.

* **Consejo 9**: Enfócate en responder las preguntas, no es necesario que llegues a escalar privilegios dentro de una máquina vulnerada.

Eso es todo lo que puedo decir.

¡MUCHA SUERTE Y ÉXITO EN TU EXAMEN!

<p align="center">
<img src="/assets/images/resenia-ewpt/CertificacionEWPT.png">
</p>
