---
title: "Reseña - Certificación eJPTv2"
date: 2023-11-10
draft: false
slug: "resenia-eJTP"
excerpt: "Esta es una reseña sobre la certificación eJPTv2, explicaré un poco (sin dar spoilers) sobre el examen y más que nada del curso al que tienes acceso solo si lo compras junto a la certificación en paquete. Además compartiré algunos consejos y links que te pueden servir a la hora que presentes el examen. Si vas a aplicar el examen, ¡mucha suerte y éxito!."
categories: ["Certifications"]
tags: ["eJPTv2", "Reseña Certificación", "Consejos"]
tools: []
links:
  - "https://security.ine.com/certifications/ejpt-certification/"
  - "https://blog.syselement.com/ine/courses/ejpt/ejpt-cheatsheet"
  - "https://github.com/JasonTurley/eJPT/blob/main/cheat-sheet.md"
  - "https://www.youtube.com/watch?v=l6tHH2qQmQ8&t=6263s"
showtoc: true
header:
  teaser: "/assets/images/resenia-ejpt/ejpt_logo2.png"
---

## ¿Qué es la Certificación eJPT? {#EJPT}

Primero y antes que nada, ¿qué es la **certificación eJPTv2**?

| **Certificación eJPT** |
|:-----------:|
| *eJPT es una certificación práctica de nivel básico del Red Team que simula las habilidades utilizadas durante enfrentamientos del mundo real. El eJPT de INE Security es para penetration testers de nivel básico y valida que el individuo tiene el conocimiento, las habilidades y las capacidades necesarias para desempeñar un papel como penetration tester junior.* |

Como bien lo dice, esta certificación válida que tienes los conocimientos básicos sobre pruebas de penetración, lo que te convierte en un **Pentester Jr**.

Es una de las certificaciones básicas que, a mi parecer, todo pentester debería de tener o incluso cualquiera que le llame la atención esta área del pentesting, ya que el curso que se imparte para tomar el examen, te adentra muy bien en esta bonita área.

Aquí puedes ver más información del examen de la certificación:
* <a href="https://security.ine.com/certifications/ejpt-certification/" target="_blank">eJPT Certification - Información de la Certificación</a>

## Reseña del Curso {#Curso}

El curso que se imparte para prepararte a la certificación es muy bueno y completo, son videos grabados que te van explicando distintos temas y claramente no necesitas mucha experiencia previa para que los puedas ver porque comienza desde 0. 

Son alrededor de **149 horas de curso**, que se puede extender o disminuir el tiempo dependiendo de cuánto te tardes en realizar los laboratorios.

Son dos profesores los que imparten este curso pregrabado, aunque a mi parecer uno de ellos, el profesor **Alexis Ahmed**, es quien se explica mejor y quien tiene otros recursos que son útiles tanto para el examen como para la práctica del día a día.

El curso cubre los siguientes temas, **divididos en 4 secciones**:

**Sección 1: Assessment Methodologies (Metodologías de Evaluación)**
* *Information Gathering (Recopilación de Información)*
* *Footprinting and Scanning (Huella digital y Escaneos)*
* *Enumeration (Enumeración de Servicios)*
* *Vulnerability Assessment (Evaluación de Vulnerabilidades)*

En esta sección vemos sobre la **recopilación de información activa y pasiva**, **enumeración de servicios (SSH, SMB, FTP, etc.)** y **búsqueda de vulnerabilidades**. También qué herramientas son útiles para esto como **nmap, dnsenum, fping, dnsrecon, arp-scan, netdiscover, searchsploit, zenmap, etc**.

**Sección 2: Host & Networking Auditing (Auditoría de Host y Redes)**
* *Auditing Fundamentals (Fundamentos de Auditoria)*

Básicamente, te explica cómo es una auditoria, **conceptos de ciberseguridad**, qué **frameworks son usados en auditorias (ISO27000, CIS, NIST, COBIT, CMMC, etc.)**, **regulaciones (PCI DSS, OSX, etc.)**. 

**Sección 3: Host & Network Penetration Testing (Pruebas de Penetración de Red y Host)**
* *System/Host Based Attacks (Pruebas de Penetración - Ataques Basados en Sistemas y Hosts)*
* *Network-Based Attacks (Ataques Basados en la Red)*
* *The Metasploit Framework (Metasploit Framework)*
* *Exploitation (Explotación)*
* *Post Exploitation (Post Explotación)*
* *Social Engineering (Ingenieria Social)*

De lo mejor del curso, acá empezamos a aplicar las **pruebas de penetración** como la metodología, un poco sobre **pruebas de penetración en redes**, aprendemos a usar **metasploit framework**, explotamos vulnerabilidades que encontramos en distintos sistemas (**Windows y Linux**) y servicios, aprenderemos sobre **ofuscación, shells**, etc., aprendemos a **escalar privilegios (post explotación)** en los sistemas vulnerados y buscamos información importante **(enumeración, obtención de credenciales, persistencia, pivoting, etc.)** y nos enseñan un poco sobre **ingeniería social (en específico phishing)**.

**Sección 4: Web Application Penetration Testing (Pruebas de Penetración de Aplicaciones Web)**
* *Web Application Penetration Testing: Introduction to the Web & HTTP Protocol (Introducción a la Web y el Protocolo HTTP)*

Vemos un poco sobre vulnerabilidades en la web cómo las **inyecciones SQL, ataques XSS, como usar BurpSuite, ataque de fuerza bruta a logins de HTTP**, etc.

Cada una de estas secciones, cubre bastante información sobre temas de **pentesting**, tienen muchos PDF que puedes descargar (cosa que te recomiendo que hagas), en donde su contenido son las diapositivas que estarás viendo en cada video de su respectiva sección y tema.

La mayoría de temás cuentan con preguntas sobre lo que se vio en el video y también laboratorios de práctica. En estos laboratorios, practicarás lo que hayas visto en los videos de su respectivo tema.

Los laboratorios son desplegados en la web, por lo que no tienes que tener conectado el Kali para resolverlos. Además, cada laboratorio cuenta con documentación sobre cómo resolverlo, siendo que esta resolución la vemos en los videos correspondientes al laboratorio. Te aconsejo que descargues estas guías para que las puedas analizar en el futuro o cuando tengas tiempo libre.

Aprovecha bien cada uno de estos recursos, ya que el examen es prácticamente lo mismo que verás aquí.

## Reseña del Examen {#Examen}

Una vez que obtienes el voucher de la certificación, cuentas con **180 días** para poder presentarlo, es decir, más o menos **6 meses**. Por lo que si compraste también el curso, tienes tiempo suficiente para hacer el curso y para practicar.

El examen consta de **35 preguntas** que deberás responder mientras haces tus **pruebas de penetración**, además **el examen dura 48 horas** para que lo puedas resolver y **tienes 2 chances para resolverlo**, ósea que si fallas 1 vez, puedes volver a presentar el examen.

El examen cubre las siguientes secciones:

<p align="center">
<img src="/assets/images/resenia-ejpt/secciones_ejpt.png">
</p>

Para aprobar el examen, **debes sacar un 70% en TODAS las secciones** que cubre el examen. **Si fallas en tan solo una de las secciones sacando menos del 70%, repruebas el examen**.

Antes de comenzar el examen, vienen algunas recomendaciones que puedes tomar, por ejemplo ver y estudiar la guía de estudio del examen (que es el curso que puedes comprar), completar los laboratorios de la guía, ver los documentos que incluye el examen (un documento que incluye el alcance, objetivos y consejos del examen, y una guía del laboratorio web que se te proporcionara en el examen), consejos sobre el ambiente ideal en donde tomar el examen y lo más importante, asegurarte de que tu nombre de usuario sea correcto, ya que será el que este impreso en tu certificado cuando apruebes el examen.

Acá te las dejo:

<p align="center">
<img src="/assets/images/resenia-ejpt/examen_ejpt.png">
</p>

Como lo he mencionado antes, el examen es sencillo, pero no te dejes engañar. 

**Este examen NO es como una CTF**, es preparado como un ambiente real, es decir, no tiene ninguna pista que puedas seguir para vulnerar los objetivos como en una **CTF** o puede que no tenga algún servicio expuesto, por lo que tendrás que ingeniártelas y recordar o repasar lo aprendido para cumplir los objetivos del examen.

Si no tienes cuidado, puedes bloquear servicios del algún sistema objetivo que estés auditando y perder tiempo en lo que reinicias el laboratorio (siempre confirma si puedes reiniciar el laboratorio del examen en caso de fallas).

Consta de una **DMZ** a la que ya tienes acceso mediante la red. Desde ese momento, tú debes aplicar los conocimientos que adquiriste en el curso, como recolectar información, enumerar los sistemas encontrados, probar vulnerabilidades, etc.

Con 48 horas, tienes tiempo más que suficiente para poder resolverlo.

## Algunos Consejos y Links de Apoyo {#Consejos}

Para explicarme mejor, voy a listar los consejos que te puedo dar para que tomes el examen con calma y te sientas seguro de tus conocimientos.

* **Consejo 1**: Te recomiendo tomar primero el curso. Es muy bueno este curso que se imparte y créeme que te ayudará bastante para responder el examen.

* **Consejo 2**: Realiza algunas máquinas en **HTB** para que te sientas bien preparado. Puedes visitar la página de máquinas resueltas del maestro **S4vitar** y escribir **eJPTv2** en el buscador para ver qué máquinas puedes realizar que te sirvan de práctica para el examen. Acá te la dejo: <a href="https://infosecmachines.io/" target="_blank">S4vitar Machine's Resolutions</a>

* **Consejo 3**: Lee muy bien el documento del alcance, objetivos del examen y reglas del examen, además de entender bien cómo funciona el laboratorio de Kali que se te dará. Es importante que entiendas bien cómo estará estructurado el laboratorio al que harás las pruebas de penetración. En estos documentos te dan algunos consejos para el examen.

* **Consejo 4**: Toma nota de todo lo que vas haciendo durante el examen, por ejemplo, anota los objetivos que ya encontraste, qué ataques sirvieron en cada uno, si encontraste contraseñas (anótalas obviamente), qué objetivo ya está vulnerado o cuál se está complicando de vulnerar, etc. Esto te sirve mucho para no repetir algunas acciones que ya hayas realizado, lo que evita mucho tiempo perdido.

* **Consejo 5**: Planea y toma descansos. El tomar descansos cada cierto tiempo va a evitar que te agobies y es bueno distraerte unos momentos cuando estás atascado. Puede que cuando regreses del descanso veas la solución que necesitas.

* **Consejo 6**: Toma todo el tiempo si es necesario, puede que termines un poco antes, pero siempre revisa tus respuestas 5 veces si es necesario y, no dejes al aire nada. Prueba todo lo que puedas y creas necesario durante el examen, claro con las debidas precauciones.

* **Consejo 7**: Si es que puedes, realiza el examen entre semana, ya que si llegas a tener un problema con tu laboratorio, puedes mandar correo para pedir una solución pronta a tu problema, caso que no podrás hacer si lo haces el fin de semana, ya que el sistema de soporte NO labora los fines de semana.

* **Consejo 8**: Contesta las preguntas en el orden que quieras, incluso varias de estas preguntas te darán pistas que te servirán en tus pruebas de penetración.

* **Consejo 9**: Practica bastante el pivoting, la fuerza bruta, la recopilación de información y la enumeración

* **Consejo 10**: NO es necesario que vulneres todos los objetivos que encuentres; el objetivo principal es responder las preguntas del examen.

Acá también te dejo unos consejos sobre el curso:

* **Consejo 1**: Te recomiendo las siguientes aplicaciones para tomar tus notas: **Obsidian y Notion**. Yo personalmente uso **Obsidian** para tomar notas, pero puedes usar cualquiera con el que te sientas cómodo.

* **Consejo 2**: Ve por completo los videos del curso y siempre toma nota de los comandos que va usando el maestro, puede que algunos de estos o alguna información que este dando **NO** se encuentre en las diapositivas.

* **Consejo 3**: Descarga todos los documentos que veas en el curso, todos tienen que ver con los laboratorios o con las diapositivas de la sección que esté viendo.

* **Consejo 4**: Si puedes, traduce las diapositivas de cada sección y las preguntas de cada tema, esto para que entiendas mejor lo que se está explicando.

<p align="center">
<img src="/assets/images/resenia-ejpt/mis-notas-ejpt.png">
</p>

Y por último, te dejo algunos links que me sirvieron durante el examen:
* <a href="https://blog.syselement.com/ine/courses/ejpt/ejpt-cheatsheet" target="_blank">eJPT Cheat Sheet</a>

* <a href="https://github.com/JasonTurley/eJPT/blob/main/cheat-sheet.md" target="_blank">Repositorio de JasonTurley: eJPT Cheat Sheet</a> 

* <a href="https://www.youtube.com/watch?v=l6tHH2qQmQ8&t=6263s" target="_blank">Simulación de Examen CEH o EJPTv2 - Laboratorio de Máquinas Virtuales</a>

¡MUCHA SUERTE Y ÉXITO EN TU EXAMEN!

<p align="center">
<img src="/assets/images/resenia-ejpt/mi_certificacionEJPT.png">
</p>
