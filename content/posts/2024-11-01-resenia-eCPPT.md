---
title: "Reseña - Certificación eCPPTv3"
date: 2024-11-01
draft: false
slug: "resenia-eCPPT"
excerpt: "Esta es una reseña (sin muchos spoilers) sobre el examen para la certificación eCPPTv3. Explicaré un poco de qué trata la certificación, cómo fue el curso de preparación que imparte INE Security y mi opinión sobre este, y una reseña del examen que me toco realizar. Además, añadiré algunos tips y consejos que te pueden ser útiles para realizar el examen.Si vas a aplicar el examen, ¡mucha suerte y éxito!."
categories: ["Certifications"]
tags: ["eCPPTv3", "Reseña Certificación", "Consejos"]
tools: []
links:
  - "https://security.ine.com/certifications/ecppt-certification/"
  - "https://academy.hackthebox.com/course/preview/introduction-to-active-directory"
  - "https://academy.hackthebox.com/course/preview/active-directory-enumeration--attacks"
showtoc: true
header:
  teaser: "/assets/images/resenia-ecppt/ecppt.png"
---

## ¿Qué es la Certificación eCPPTv3? {#eCPPTv3}

Primero y antes que nada, ¿qué es la **certificación eCPPTv3**?

| **Certificación eCPPT** |
|:-----------:|
| *El eCPPT (eLearnSecurity Certified Professional Penetration Tester) es una certificación de ciberseguridad que ofrece eLearnSecurity, enfocada en las habilidades prácticas de pruebas de penetración (pentesting). A diferencia de otras certificaciones teóricas, el eCPPT se basa en un examen práctico, donde los candidatos deben realizar una prueba de penetración en un entorno realista y redactar un informe profesional con los resultados y las recomendaciones.* |

El obtener la **certificación eCPPT**, indica que tienes los conocimientos suficientes para considerarte un pentester profesional.

La **certificación eCPPT** tiene varias versiones. 

Actualmente, está activa la **versión 3**, que se enfoca más en **Active Directory (AD)** implementado en entornos empresariales, siendo muy similar a la **certificación OSCP** actual. 

La versión anterior (**versión 2**), aún sigue siendo utilizada este año (2024), ya que se actualizó recientemente a su nueva versión, pero sí compras la certificación en estas fechas, te darán la **versión 3**.

Esta **versión 3**, viene con cambios muy significativos, ya que en la versión anterior tenías alrededor de 7 días para resolver el laboratorio del examen y otros 7 días para crear un reporte que sería calificado. Dependiendo de los hallazgos y el cómo realizaste tu reporte, te indicarían si aprobaste o no la certificación. Ahora, solamente tienes 1 día para resolver el examen y no tienes que entregar un reporte, siendo esto último, algo que no me gustó mucho, ya que crear reportes es algo vital que debemos de conocer y saber hacer los pentesters.

Aquí puedes encontrar más información sobre la certificación:

* <a href="https://security.ine.com/certifications/ecppt-certification/" target="_blank">eCPPT Certification</a>

## Reseña del Curso de Preparación {#Curso}

De una vez lo menciono, el curso que se imparte para prepararte ante esta certificación es bueno, pero **NO ES SUFICIENTE**, ya que a mi parecer, falta enfocarse mucho en la parte del **Active Directory**, pues a mi parecer, solamente te enseñan una pequeña parte de lo que es **AD** y como lo puedes explotar desde adentro más no desde afuera.

Además, hay una que otra sección que está un poco de más dentro del curso, aunque se aprecia mucho que cubran otras secciones como lo son **Buffer Overflow** y **lenguaje ensamblador**, creo que es necesario mejorar mucho la sección de AD.

Actualmente, **el curso consta de 107 horas** (a menos que las quejas de que falta más contenido haga que actualicen de nuevo el curso), que se puede extender o disminuir, dependiendo del tiempo que te tome resolver los laboratorios.

Quien imparte el curso, es el master **Alexis Ahmed**, por lo que tendrás una buena experiencia a través del curso.

El curso se divide en 6 secciones:

**Sección 1: Resource Development & Initial Access (Desarrollo de recursos y acceso inicial)**
* *PowerShell for Pentesters (PowerShell para Pentesters)*
* *Client-Side Attacks (Ataques del Lado del Cliente*

Bastante buena esta parte, ya que tocamos bastante el uso de **PowerShell** desde cero, como podemos usarlo para creación de scripts, para evasión de AV, ofuscación, etc. Además, me quedé picado con los ataques del lado del cliente, ya que nos enseñan a crear macros que se pueden usar para muchas cosas, en especial maliciosas (me encantó esta parte y la estudiaré muy a fondo, quizá muestre algo por aquí algún día).

**Sección 2: Web Application Attacks (Ataques a aplicaciones web)**
* *Web Application Penetration Testing (Pruebas de Penetración en Aplicaciones Web)*

Es buena esta sección, aunque siento que tocamos los mismos temas que en el **curso del eJPT** (esto será algo recurrente), pero no está demás una refrescada sobre cómo recopilar información pasiva de la web, cómo aplicar fuerza bruta en directorios web, cómo aplicar **SQLi y XSS**, etc.

**Sección 3: Security (Seguridad)**
* *Network Penetration Testing (Pruebas de Penetración en la Red)*

Lo mismo que el anterior, se repiten temas que vimos en el **curso del eJPT**, aunque nos dan un poco más de información sobre el uso de **Wireshark y tcpdump**, el cómo analizar los paquetes se van capturando y distintas técnicas para evadir AV o IDS para descubrir hosts, bastante útil el uso de estas herramientas y técnicas.

**Sección 4: Exploit Development (Desarrollo de Exploits)**
* *System Security & x86 Assembly Fundamentals (Seguridad del Sistema y Fundamentos del Ensamblador x86)*
* *Exploit Development: Buffer Overflows*

Muy buena sección donde aprendemos los fundamentos básicos sobre la arquitectura de un CPU, el lenguaje ensamblador, los fundamentos básicos del **Buffer Overflow** y el cómo encontrarlos y explotarlos.

**Sección 5: Post-Exploitation (Post-Explotación)**
* *Privilege Escalation (Escalada de Privilegios)*
* *Lateral Movement & Pivoting (Movimientos Laterales y Pivoting)*

Una excelente sección para entender como escalar privilegios en **Windows** y **Linux**, desde como utilizar **PowerUp y PrivescCheck** (muy útiles para **AD**), hasta como podemos usar un **DLL** para escalar privilegios y en el caso de **Linux**, el cómo podemos aprovechar los privilegios de un usuario para escalar privilegios, permisos en archivos o scripts, etc. Además, se repite un poco lo que se ve en el **curso del eJPT**, pero para el caso de los movimientos laterales y el pivoting, se ven cosillas bastante buenas como el uso de **Evil-WinRM**, **crackmapexec**, **metasploit**, varias formas de aplicar pivoting como con **socks proxy**, etc.

**Sección 6: Red Teaming**
* *Active Directory Penetration Testing (Pruebas de Penetración en Directorio Activo)*
* *Command and Control (C2/C&C)*

Una excelente sección para aprender (aunque muy poco a mi parecer) sobre **AD**, como los fundamentos básicos de **AD**, como explotarlo desde adentro, como moverte lateralmente, algunas herramientas útiles para esta clase de pruebas de penetración como **PowerUp, PowerView, BloodHound**, etc., distintas técnicas para escalar privilegios y persistencia. También me gustó bastante el uso de algunos frameworks que nos pueden ayudar en nuestras pruebas de penetración como **PowerShell Empire, StarKiller**, etc.

En general, es bueno el curso, tiene bastantes temas que nos serán útiles en nuestro examen, pero lo vuelvo a mencionar, no es suficiente con esto.

Aprovecha bastante los laboratorios de **AD**, más que nada para practicar la obtención de información, ya sea para encontrar la forma de escalar privilegios usando **BloodHound o PrivescCheck** o para obtener información de X usuario o X grupo usando **PowerView**.

**Los PDF e instrucciones para resolver los laboratorios**, contienen información extra que no se llega a comentar o cubrir del todo, así que échales un ojo.

## Reseña del Examen {#Examen}

Una vez que obtienes el baucher de la certificación, cuentas con **180 días** para poder presentarlo, es decir, más o menos **6 meses**. Por lo que si compraste también el curso, tienes tiempo suficiente para hacer el curso y para practicar.

El examen consta de **45 preguntas** (10 preguntas más que en el **eJTP**) que deberás responder mientras haces tus pruebas de penetración.

Esta vez, el examen dura solamente **24 horas** para que lo puedas resolver y tienes 2 chances para resolverlo, ósea, que si fallas 1 vez, puedes volver a presentar el examen.

Para aprobar el examen, debemos obtener el **70% dentro de todo el examen**, ya no es necesario que en todas las secciones tengas al menos el **70%** como en el **eJTP**.

El examen cubre los siguientes temas:

<p align="center">
<img src="/assets/images/resenia-ecppt/Captura1.png">
</p>

De igual forma que en el **examen del eJPT**, te dan algunos consejos que puedes tomar para aprobar el examen:

<p align="center">
<img src="/assets/images/resenia-ecppt/Captura2.png">
</p>

Con esto cubierto, vayamos a lo bueno.

Hay varias cosas que tengo que decir del examen, pero lo principal es: se siente incompleto.

Quizá fue el laboratorio que me tocó o quizás no, la verdad no lo sé, pues hubo partes en las que se da a entender que debía encontrar algo que no estuvo presente en mi laboratorio, por ejemplo, un archivo o una contraseña.

Por si fuera poco, algunas herramientas no me funcionaron para nada y que son cruciales para el examen (aunque no indispensables), por ejemplo, **hashcat** y **evil-winrm** no me funcionaron.

Había leído por ahí en otras reviews que les pasó lo mismo, por lo que deberás tener cuidado y siempre tener una herramienta alternativa.

Para el caso de los recursos para la post explotación del **AD**, se me hizo un revoltijo la forma en la que las guardaron, ya que tienes que buscar las únicas que te enseñaron a usar entre un montón de directorios que tienen otras herramientas que no tocamos en el curso.

Por último, debo decir que varias veces se cayó el **servidor de Guacamole** que ocupa el laboratorio, lo que hizo que perdiera bastante tiempo del examen.

## Algunos Consejos y Links de Apoyo {#Consejos}

Como has visto, hay muchas irregularidades dentro del examen, pero nada que te impida pasarlo.

Estos son algunos consejos que te puedo dar para que se te haga más fácil el examen:

* **Consejo 1:** Recuerda que **NO ES UNA CTF**, es un entorno que te pondrá retos si no tienes cuidado con las herramientas que utilices.

* **Consejo 2:** Igual que en el **eJPT**, no es necesario que vulneres al 100% las máquinas que te toquen, solamente te puedes enfocar en responder las preguntas y listo.

* **Consejo 3:** Solo te diré esto, nada de **Password Spraying**, no pierdas tu tiempo con esto.

* **Consejo 4:** Te recomiendo mucho realizar **máquinas de HTB enfocadas en AD**, ya que las técnicas que llegues a utilizar, se pueden aplicar a entornos **AD** reales y la mayoría de las máquinas del examen son tipo **AD**.

* **Consejo 5:** Ubica bien los recursos que vas a utilizar dentro del revoltijo de recursos y herramientas que te dan y ponlos en un solo directorio para su rápido acceso. Esto evitará que pierdas mucho tiempo buscando entre directorios el recurso o herramienta que necesites.

* **Consejo 6:** Más que un consejo, es un mega tip, ya que la siguiente declaración es una total mentira:

<p align="center">
<img src="/assets/images/resenia-ecppt/Captura3.png">
</p>

* **Consejo 7:** Ocupar estos wordlists te ayudará bastante a ahorrar tiempo (algunos los traduje para que queden como pistas, pero creo que se entiende bien a cuáles me refiero):
	* *mesesotes.txt*
	* *temporadas del año.txt*
	* *corporaciones_comunes.txt*
	* *chato10000.txt*
	* *rockyou.txt*

* **Consejo 8:** Sigue el orden que quieras para responder las preguntas, pues muchas de estas te pueden dar una idea de lo que tienes que hacer, al igual que con el **examen del eJPT**.

* **Consejo 9:** Toma nota constantemente de lo que vayas encontrando, ya que si se te llega a trabar el laboratorio o a caer el **servidor de Guacamole**, es posible que las terminales que tenías abiertas se hayan limpiado, por lo que si habías encontrado algo y lo dejaste para anotarlo después, se eliminó de tu terminal y lo debes volver a encontrar.

* **Consejo 10:** Toma descansos para estirar el cuerpo y relajarte, en mi caso me sirvió para pensar fuera de la caja y recordar otras formas de vulnerar una máquina **AD**.

* **Consejo 11:** Ten cuidado con reiniciar el laboratorio. Había leído que esto puede provocar que elimine, cambie o mueva ciertos archivos necesarios para responder preguntas del examen. Por esta razón, no reinicie mi laboratorio.

* **Consejo 12:** Estos son algunos módulos de **HTB Academy** que te pueden ayudar para estudiar:
	* <a href="https://academy.hackthebox.com/course/preview/introduction-to-active-directory" target="_blank">Introduction to Active Directory</a>
	* <a href="https://academy.hackthebox.com/course/preview/active-directory-enumeration--attacks" target="_blank">Active Directory Enumeration & Attacks</a>

* **Consejo 13:** Ten paciencia y no te desesperes, las 24 horas son más que suficientes para acabar el examen.

* **Consejo 14:** Tómate todo el tiempo del examen si es necesario (obviamente envía antes tus respuestas, ya que si no lo haces, tu examen se cancela), por ejemplo, yo me tome 23 horas para realizarlo y así pude obtener y responder varias preguntas, que de no haber esperado, seguramente no habría pasado el examen.

Por último, te quiero compartir las herramientas que utilicé (omití algunas, ya que pueden ser mucho spoiler del examen):

* *nmap*
* *dig*
* *smbclient*
* *hydra*
* *metasploit (hta_server y handler)*
* *ssh*
* *wpscan*
* *netstat*
* *crackmapexec*
* *impacket-GetNPUsers*
* *rpcclient*
* *xfreerdp*
* *kerbrute*
* *PowerView.ps1*
* *PowerUp.ps1*
* *mimikatz.exe y ps1*
* *ldapsearch*
* *Meterpreter: getsystem, kiwi*
* *BloodHound*
* *neo4j*
* *bloodhoun-python*
* *GTFOBins*

Eso es todo lo que puedo decir.

¡MUCHA SUERTE Y ÉXITO EN TU EXAMEN!

<p align="center">
<img src="/assets/images/resenia-ecppt/certificacion_eCPPTv3.png">
</p>
